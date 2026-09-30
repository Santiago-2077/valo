import datetime as dt
from collections import defaultdict
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from app.clock import today
from app.deps import CurrentUser, SessionDep
from app.models import Card, CardKind, Category, Expense, InstallmentPlan
from app.schemas import Money, MoneyIn, ORMModel
from app.services.cards import card_statement_for
from app.services.installments import regenerate_charges

router = APIRouter(prefix="/installments", tags=["installments"])


class PlanIn(BaseModel):
    description: str = Field(min_length=1, max_length=120)
    total: MoneyIn
    n_months: int = Field(ge=2, le=48)
    interest_free: bool = True
    purchase_date: dt.date
    card_id: int
    category_id: int | None = None
    is_impulse: bool = False
    note: str | None = Field(default=None, max_length=2000)


class Charge(BaseModel):
    number: int
    expense_id: int
    date: dt.date
    amount: Money
    cycle: str
    due_date: dt.date
    paid: bool  # its payment due date has passed


class PlanOut(ORMModel):
    id: int
    description: str
    total: Money
    n_months: int
    interest_free: bool
    purchase_date: dt.date
    card_id: int
    category_id: int | None
    is_impulse: bool
    note: str | None
    monthly_amount: Money
    paid_count: int
    remaining_amount: Money
    next_charge: Charge | None
    charges: list[Charge]


class MonthCommitment(BaseModel):
    month: str  # YYYY-MM of the payment due date
    total: Money
    plans: int


async def _get(session: SessionDep, plan_id: int) -> InstallmentPlan:
    plan = await session.get(InstallmentPlan, plan_id)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan no encontrado")
    return plan


async def _credit_card(session: SessionDep, data: PlanIn, current: int | None) -> Card:
    card = await session.get(Card, data.card_id)
    if card is None or (not card.active and card.id != current):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Tarjeta inválida o inactiva")
    if card.kind != CardKind.CREDIT:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Las compras a meses van con tarjeta de crédito"
        )
    if data.category_id is not None and await session.get(Category, data.category_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Categoría inválida")
    return card


async def _charges(session: SessionDep, plan: InstallmentPlan) -> list[Charge]:
    card = await session.get(Card, plan.card_id)
    assert card is not None
    rows = await session.scalars(
        select(Expense)
        .where(Expense.installment_plan_id == plan.id)
        .order_by(Expense.installment_number)
    )
    now = today()
    charges = []
    for e in rows:
        statement = card_statement_for(card, e.date)
        assert statement is not None
        charges.append(
            Charge(
                number=e.installment_number or 0,
                expense_id=e.id,
                date=e.date,
                amount=e.amount_mxn,
                cycle=statement.cycle,
                due_date=statement.due_date,
                paid=statement.due_date < now,
            )
        )
    return charges


async def _to_out(session: SessionDep, plan: InstallmentPlan) -> PlanOut:
    charges = await _charges(session, plan)
    pending = [c for c in charges if not c.paid]
    return PlanOut.model_validate(
        {
            **{k: getattr(plan, k) for k in PlanIn.model_fields},
            "id": plan.id,
            "monthly_amount": charges[0].amount if charges else Decimal(0),
            "paid_count": len(charges) - len(pending),
            "remaining_amount": sum((c.amount for c in pending), Decimal(0)),
            "next_charge": pending[0] if pending else None,
            "charges": charges,
        }
    )


async def _save(
    session: SessionDep, plan: InstallmentPlan, data: PlanIn, card: Card
) -> InstallmentPlan:
    for key, value in data.model_dump().items():
        setattr(plan, key, value)
    session.add(plan)
    await session.flush()  # assigns plan.id for new plans
    await regenerate_charges(session, plan, card)
    await session.commit()
    return plan


@router.get("", response_model=list[PlanOut])
async def list_plans(
    session: SessionDep, _: CurrentUser, include_finished: bool = False
) -> list[PlanOut]:
    plans = await session.scalars(
        select(InstallmentPlan).order_by(InstallmentPlan.purchase_date.desc())
    )
    out = [await _to_out(session, p) for p in plans]
    return out if include_finished else [p for p in out if p.next_charge is not None]


@router.get("/commitments", response_model=list[MonthCommitment])
async def commitments(
    session: SessionDep, _: CurrentUser, months: Annotated[int, Query(ge=1, le=48)] = 6
) -> list[MonthCommitment]:
    """How much installment charges you'll pay each month, by payment due month."""
    now = today()
    cards = {c.id: c for c in await session.scalars(select(Card))}
    rows = await session.scalars(
        select(Expense).where(
            Expense.installment_plan_id.is_not(None),
            # A charge dated a couple of months back can still be unpaid; filter precisely below.
            Expense.date >= now - dt.timedelta(days=75),
        )
    )
    totals: dict[str, Decimal] = defaultdict(Decimal)
    plans: dict[str, set[int]] = defaultdict(set)
    for e in rows:
        statement = card_statement_for(cards[e.card_id], e.date)
        if statement is None or statement.due_date < now or e.installment_plan_id is None:
            continue
        key = f"{statement.due_date.year:04d}-{statement.due_date.month:02d}"
        totals[key] += e.amount_mxn
        plans[key].add(e.installment_plan_id)

    result = []
    year, mon = now.year, now.month
    for _i in range(months):
        key = f"{year:04d}-{mon:02d}"
        result.append(MonthCommitment(month=key, total=totals[key], plans=len(plans[key])))
        year, mon = (year + 1, 1) if mon == 12 else (year, mon + 1)
    return result


@router.post("", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(data: PlanIn, session: SessionDep, _: CurrentUser) -> PlanOut:
    card = await _credit_card(session, data, current=None)
    plan = await _save(session, InstallmentPlan(), data, card)
    return await _to_out(session, plan)


@router.get("/{plan_id}", response_model=PlanOut)
async def get_plan(plan_id: int, session: SessionDep, _: CurrentUser) -> PlanOut:
    return await _to_out(session, await _get(session, plan_id))


@router.put("/{plan_id}", response_model=PlanOut)
async def update_plan(plan_id: int, data: PlanIn, session: SessionDep, _: CurrentUser) -> PlanOut:
    plan = await _get(session, plan_id)
    card = await _credit_card(session, data, current=plan.card_id)
    await _save(session, plan, data, card)
    return await _to_out(session, plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(plan_id: int, session: SessionDep, _: CurrentUser) -> None:
    plan = await _get(session, plan_id)
    # Explicit instead of relying on ON DELETE CASCADE, so it also holds on SQLite.
    await session.execute(delete(Expense).where(Expense.installment_plan_id == plan_id))
    await session.delete(plan)
    await session.commit()
