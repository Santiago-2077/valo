import datetime as dt
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update

from app.clock import today
from app.deps import CurrentUser, SessionDep
from app.models import Card, CardKind, Frequency, Income, IncomeKind, RecurringIncome
from app.schemas import (
    SCHEDULE_FIELDS,
    Money,
    MoneyIn,
    ORMModel,
    ScheduleIn,
    schedule_costs,
)
from app.services.recurring import materialize_due, schedule_from

router = APIRouter(tags=["incomes"])


# --- one-off and recorded incomes ------------------------------------------------------


class IncomeIn(BaseModel):
    date: dt.date
    description: str = Field(min_length=1, max_length=120)
    amount: MoneyIn
    kind: IncomeKind = IncomeKind.OTHER
    account_id: int | None = None
    note: str | None = Field(default=None, max_length=2000)


class IncomeOut(ORMModel):
    id: int
    date: dt.date
    description: str
    amount: Money
    kind: IncomeKind
    account_id: int | None
    note: str | None
    recurring_income_id: int | None


class IncomePage(BaseModel):
    items: list[IncomeOut]
    total: int
    sum: Money


async def _validate_account(session: SessionDep, account_id: int | None) -> None:
    if account_id is None:
        return
    account = await session.get(Card, account_id)
    if account is None or account.kind == CardKind.CREDIT:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Los ingresos van a una cuenta de débito o efectivo",
        )


async def _get_income(session: SessionDep, income_id: int) -> Income:
    income = await session.get(Income, income_id)
    if income is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ingreso no encontrado")
    return income


@router.get("/incomes", response_model=IncomePage)
async def list_incomes(
    session: SessionDep,
    _: CurrentUser,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    kind: IncomeKind | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> IncomePage:
    query = select(Income)
    if date_from:
        query = query.where(Income.date >= date_from)
    if date_to:
        query = query.where(Income.date <= date_to)
    if kind:
        query = query.where(Income.kind == kind)
    filtered = query.subquery()
    count, total = (
        await session.execute(select(func.count(), func.coalesce(func.sum(filtered.c.amount), 0)))
    ).one()
    rows = await session.scalars(
        query.order_by(Income.date.desc(), Income.id.desc()).limit(limit).offset(offset)
    )
    return IncomePage(
        items=[IncomeOut.model_validate(i) for i in rows], total=count, sum=Decimal(total)
    )


@router.post("/incomes", response_model=IncomeOut, status_code=status.HTTP_201_CREATED)
async def create_income(data: IncomeIn, session: SessionDep, _: CurrentUser) -> Income:
    await _validate_account(session, data.account_id)
    income = Income(**data.model_dump())
    session.add(income)
    await session.commit()
    return income


@router.put("/incomes/{income_id}", response_model=IncomeOut)
async def update_income(
    income_id: int, data: IncomeIn, session: SessionDep, _: CurrentUser
) -> Income:
    income = await _get_income(session, income_id)
    await _validate_account(session, data.account_id)
    for key, value in data.model_dump().items():
        setattr(income, key, value)
    await session.commit()
    return income


@router.delete("/incomes/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(income_id: int, session: SessionDep, _: CurrentUser) -> None:
    await session.delete(await _get_income(session, income_id))
    await session.commit()


# --- fixed incomes that record themselves ----------------------------------------------


class RecurringIncomeIn(ScheduleIn):
    name: str = Field(min_length=1, max_length=80)
    kind: IncomeKind = IncomeKind.SALARY
    account_id: int | None = None


class RecurringIncomeOut(ORMModel):
    id: int
    name: str
    kind: IncomeKind
    amount: Money
    amount_is_estimate: bool
    account_id: int | None
    frequency: Frequency
    day_of_month: int
    second_day: int | None
    month_of_year: int | None
    active: bool
    next_run: dt.date
    monthly_amount: Money
    yearly_amount: Money
    last_received: dt.date | None = None


async def _recurring_out(session: SessionDep, source: RecurringIncome) -> RecurringIncomeOut:
    monthly, yearly = schedule_costs(source.frequency, source.amount)
    last = await session.scalar(
        select(func.max(Income.date)).where(Income.recurring_income_id == source.id)
    )
    fields = {k: getattr(source, k) for k in RecurringIncomeOut.model_fields if hasattr(source, k)}
    return RecurringIncomeOut.model_validate(
        {**fields, "monthly_amount": monthly, "yearly_amount": yearly, "last_received": last}
    )


async def _get_recurring(session: SessionDep, source_id: int) -> RecurringIncome:
    source = await session.get(RecurringIncome, source_id)
    if source is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ingreso fijo no encontrado")
    return source


@router.get("/recurring-incomes", response_model=list[RecurringIncomeOut])
async def list_recurring_incomes(session: SessionDep, _: CurrentUser) -> list[RecurringIncomeOut]:
    rows = await session.scalars(
        select(RecurringIncome).order_by(RecurringIncome.active.desc(), RecurringIncome.next_run)
    )
    return [await _recurring_out(session, r) for r in rows]


@router.post(
    "/recurring-incomes", response_model=RecurringIncomeOut, status_code=status.HTTP_201_CREATED
)
async def create_recurring_income(
    data: RecurringIncomeIn, session: SessionDep, _: CurrentUser
) -> RecurringIncomeOut:
    await _validate_account(session, data.account_id)
    source = RecurringIncome(**data.model_dump(exclude={"starts_on"}))
    source.next_run = schedule_from(source, data.starts_on or today())
    session.add(source)
    await session.commit()
    await materialize_due(session, today())
    return await _recurring_out(session, source)


@router.put("/recurring-incomes/{source_id}", response_model=RecurringIncomeOut)
async def update_recurring_income(
    source_id: int, data: RecurringIncomeIn, session: SessionDep, _: CurrentUser
) -> RecurringIncomeOut:
    source = await _get_recurring(session, source_id)
    await _validate_account(session, data.account_id)
    values = data.model_dump(exclude={"starts_on"})
    reschedule = any(getattr(source, k) != values[k] for k in SCHEDULE_FIELDS) or (
        values["active"] and not source.active
    )
    for key, value in values.items():
        setattr(source, key, value)
    if reschedule:
        source.next_run = schedule_from(source, today())
    await session.commit()
    await materialize_due(session, today())
    return await _recurring_out(session, source)


@router.delete("/recurring-incomes/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_income(source_id: int, session: SessionDep, _: CurrentUser) -> None:
    """Stops future incomes. Incomes already recorded are kept."""
    await _get_recurring(session, source_id)
    await session.execute(
        update(Income)
        .where(Income.recurring_income_id == source_id)
        .values(recurring_income_id=None)
    )
    await session.execute(delete(RecurringIncome).where(RecurringIncome.id == source_id))
    await session.commit()
