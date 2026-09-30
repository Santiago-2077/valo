import datetime as dt
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.deps import CurrentUser, SessionDep
from app.models import Card, Category, Expense
from app.schemas import InstallmentRef, Money, MoneyIn, ORMModel, StatementRef
from app.services.cards import card_statement_for, to_ref
from app.services.installments import installment_refs

router = APIRouter(prefix="/expenses", tags=["expenses"])


class ExpenseIn(BaseModel):
    date: dt.date
    description: str = Field(min_length=1, max_length=120)
    amount: MoneyIn
    currency: Literal["MXN"] = "MXN"
    card_id: int
    category_id: int | None = None
    is_impulse: bool = False
    note: str | None = Field(default=None, max_length=2000)


class ExpenseOut(ORMModel):
    id: int
    date: dt.date
    description: str
    amount: Money
    currency: str
    fx_rate: Money
    amount_mxn: Money
    card_id: int
    category_id: int | None
    is_impulse: bool
    note: str | None
    recurring_id: int | None = None
    statement: StatementRef | None = None
    installment: InstallmentRef | None = None


class ExpensePage(BaseModel):
    items: list[ExpenseOut]
    total: int
    sum_mxn: Money


async def _to_out(session: SessionDep, expense: Expense) -> ExpenseOut:
    out = ExpenseOut.model_validate(expense)
    card = await session.get(Card, expense.card_id)
    statement = card_statement_for(card, expense.date) if card else None
    out.statement = to_ref(statement) if statement else None
    out.installment = (await installment_refs(session, [expense])).get(expense.id)
    return out


async def _validate_refs(
    session: SessionDep, data: ExpenseIn, *, allow_inactive: int | None
) -> None:
    card = await session.get(Card, data.card_id)
    if card is None or (not card.active and card.id != allow_inactive):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Tarjeta inválida o inactiva")
    if data.category_id is not None and await session.get(Category, data.category_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Categoría inválida")


def _apply(expense: Expense, data: ExpenseIn) -> None:
    for key, value in data.model_dump().items():
        setattr(expense, key, value)
    expense.fx_rate = Decimal(1)
    expense.amount_mxn = data.amount


async def _get(session: SessionDep, expense_id: int) -> Expense:
    expense = await session.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gasto no encontrado")
    return expense


def _ensure_standalone(expense: Expense) -> None:
    if expense.installment_plan_id is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Es una cuota de una compra a meses; editá el plan"
        )


@router.get("", response_model=ExpensePage)
async def list_expenses(
    session: SessionDep,
    _: CurrentUser,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    card_id: int | None = None,
    category_id: int | None = None,
    uncategorized: bool = False,
    is_impulse: bool | None = None,
    q: Annotated[str | None, Query(max_length=60)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ExpensePage:
    query = select(Expense)
    if date_from:
        query = query.where(Expense.date >= date_from)
    if date_to:
        query = query.where(Expense.date <= date_to)
    if card_id is not None:
        query = query.where(Expense.card_id == card_id)
    if uncategorized:
        query = query.where(Expense.category_id.is_(None))
    elif category_id is not None:
        query = query.where(Expense.category_id == category_id)
    if is_impulse is not None:
        query = query.where(Expense.is_impulse == is_impulse)
    if q:
        query = query.where(Expense.description.ilike(f"%{q}%"))

    filtered = query.subquery()
    count, total = (
        await session.execute(
            select(func.count(), func.coalesce(func.sum(filtered.c.amount_mxn), 0))
        )
    ).one()
    rows = await session.scalars(
        query.order_by(Expense.date.desc(), Expense.id.desc()).limit(limit).offset(offset)
    )
    expenses = list(rows)
    cards = {c.id: c for c in await session.scalars(select(Card))}
    refs = await installment_refs(session, expenses)
    items = []
    for e in expenses:
        out = ExpenseOut.model_validate(e)
        statement = card_statement_for(cards[e.card_id], e.date)
        out.statement = to_ref(statement) if statement else None
        out.installment = refs.get(e.id)
        items.append(out)
    return ExpensePage(items=items, total=count, sum_mxn=Decimal(total))


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_expense(data: ExpenseIn, session: SessionDep, _: CurrentUser) -> ExpenseOut:
    await _validate_refs(session, data, allow_inactive=None)
    expense = Expense()
    _apply(expense, data)
    session.add(expense)
    await session.commit()
    return await _to_out(session, expense)


@router.get("/{expense_id}", response_model=ExpenseOut)
async def get_expense(expense_id: int, session: SessionDep, _: CurrentUser) -> ExpenseOut:
    return await _to_out(session, await _get(session, expense_id))


@router.put("/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: int, data: ExpenseIn, session: SessionDep, _: CurrentUser
) -> ExpenseOut:
    expense = await _get(session, expense_id)
    _ensure_standalone(expense)
    # Editing an old expense on a since-deactivated card is fine; moving to one is not.
    await _validate_refs(session, data, allow_inactive=expense.card_id)
    _apply(expense, data)
    await session.commit()
    return await _to_out(session, expense)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(expense_id: int, session: SessionDep, _: CurrentUser) -> None:
    expense = await _get(session, expense_id)
    _ensure_standalone(expense)
    await session.delete(expense)
    await session.commit()
