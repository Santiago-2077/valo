import datetime as dt

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update

from app.clock import today
from app.deps import CurrentUser, SessionDep
from app.models import Card, Category, Expense, Frequency, RecurringCharge, RecurringKind
from app.schemas import SCHEDULE_FIELDS, Money, ORMModel, ScheduleIn, schedule_costs
from app.services.recurring import materialize_due, schedule_from

router = APIRouter(prefix="/recurring", tags=["recurring"])


class RecurringIn(ScheduleIn):
    name: str = Field(min_length=1, max_length=80)
    kind: RecurringKind
    card_id: int
    category_id: int | None = None


class RecurringOut(ORMModel):
    id: int
    name: str
    kind: RecurringKind
    amount: Money
    currency: str
    amount_is_estimate: bool
    card_id: int
    category_id: int | None
    frequency: Frequency
    day_of_month: int
    second_day: int | None
    month_of_year: int | None
    active: bool
    next_run: dt.date
    monthly_cost: Money
    yearly_cost: Money
    last_charged: dt.date | None = None


class RunResult(BaseModel):
    created: int


async def _to_out(session: SessionDep, charge: RecurringCharge) -> RecurringOut:
    monthly, yearly = schedule_costs(charge.frequency, charge.amount)
    last = await session.scalar(
        select(func.max(Expense.date)).where(Expense.recurring_id == charge.id)
    )
    return RecurringOut.model_validate(
        {
            **{k: getattr(charge, k) for k in RecurringOut.model_fields if hasattr(charge, k)},
            "monthly_cost": monthly,
            "yearly_cost": yearly,
            "last_charged": last,
        }
    )


async def _get(session: SessionDep, charge_id: int) -> RecurringCharge:
    charge = await session.get(RecurringCharge, charge_id)
    if charge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recurrente no encontrado")
    return charge


async def _validate_refs(session: SessionDep, data: RecurringIn, current: int | None) -> None:
    card = await session.get(Card, data.card_id)
    if card is None or (not card.active and card.id != current):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Tarjeta inválida o inactiva")
    if data.category_id is not None and await session.get(Category, data.category_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Categoría inválida")


@router.get("", response_model=list[RecurringOut])
async def list_recurring(session: SessionDep, _: CurrentUser) -> list[RecurringOut]:
    charges = await session.scalars(
        select(RecurringCharge).order_by(RecurringCharge.active.desc(), RecurringCharge.next_run)
    )
    return [await _to_out(session, c) for c in charges]


@router.post("", response_model=RecurringOut, status_code=status.HTTP_201_CREATED)
async def create_recurring(data: RecurringIn, session: SessionDep, _: CurrentUser) -> RecurringOut:
    await _validate_refs(session, data, current=None)
    charge = RecurringCharge(**data.model_dump(exclude={"starts_on"}))
    charge.next_run = schedule_from(charge, data.starts_on or today())
    session.add(charge)
    await session.commit()
    await materialize_due(session, today())
    return await _to_out(session, charge)


@router.put("/{charge_id}", response_model=RecurringOut)
async def update_recurring(
    charge_id: int, data: RecurringIn, session: SessionDep, _: CurrentUser
) -> RecurringOut:
    """Changes apply to future charges; past expenses stay as they were."""
    charge = await _get(session, charge_id)
    await _validate_refs(session, data, current=charge.card_id)
    values = data.model_dump(exclude={"starts_on"})
    reschedule = any(getattr(charge, k) != values[k] for k in SCHEDULE_FIELDS) or (
        values["active"] and not charge.active
    )
    for key, value in values.items():
        setattr(charge, key, value)
    if reschedule:
        # Resuming or moving the date never back-fills the skipped period.
        charge.next_run = schedule_from(charge, today())
    await session.commit()
    await materialize_due(session, today())
    return await _to_out(session, charge)


@router.delete("/{charge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring(charge_id: int, session: SessionDep, _: CurrentUser) -> None:
    """Stops future charges. Expenses already logged are kept."""
    await _get(session, charge_id)
    await session.execute(
        update(Expense).where(Expense.recurring_id == charge_id).values(recurring_id=None)
    )
    await session.execute(delete(RecurringCharge).where(RecurringCharge.id == charge_id))
    await session.commit()


@router.post("/run", response_model=RunResult)
async def run_now(session: SessionDep, _: CurrentUser) -> RunResult:
    """Materialize due charges now (the daily job does this automatically)."""
    return RunResult(created=await materialize_due(session, today()))
