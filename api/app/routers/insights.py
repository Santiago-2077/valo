import datetime as dt
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import InstrumentedAttribute

from app.clock import today
from app.deps import CurrentUser, SessionDep
from app.models import CardPayment, Category, Expense, Income, RecurringCharge
from app.schemas import Money, schedule_costs
from app.services.billing import parse_cycle

router = APIRouter(prefix="/insights", tags=["insights"])


class CategorySpend(BaseModel):
    category_id: int | None
    spent: Money
    budget: Money | None
    ratio: float | None  # spent / budget


class MonthInsights(BaseModel):
    month: str
    income: Money
    expenses: Money
    balance: Money  # income - expenses
    impulse: Money
    installments: Money  # installment charges dated this month
    recurring: Money  # charges from fixed subscriptions/services dated this month
    card_payments: Money
    previous_expenses: Money
    fixed_monthly_cost: Money  # what active subscriptions/services cost per month
    budget_total: Money
    budget_spent: Money  # spending in categories that have a budget
    categories: list[CategorySpend]


def _month_bounds(month: str) -> tuple[dt.date, dt.date]:
    try:
        year, mon = parse_cycle(month)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    start = dt.date(year, mon, 1)
    end = dt.date(year + (mon == 12), mon % 12 + 1, 1) - dt.timedelta(days=1)
    return start, end


async def _sum(
    session: SessionDep, column: InstrumentedAttribute[Decimal], *where: ColumnElement[bool]
) -> Decimal:
    value = await session.scalar(select(func.coalesce(func.sum(column), 0)).where(*where))
    return Decimal(value or 0)


@router.get("/month", response_model=MonthInsights)
async def month_insights(
    session: SessionDep,
    _: CurrentUser,
    month: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
) -> MonthInsights:
    """Cash picture of a calendar month: income vs spending, budgets and fixed costs."""
    month = month or today().strftime("%Y-%m")
    start, end = _month_bounds(month)
    prev_end = start - dt.timedelta(days=1)
    prev_start = prev_end.replace(day=1)
    in_month = (Expense.date >= start, Expense.date <= end)

    income = await _sum(session, Income.amount, Income.date >= start, Income.date <= end)
    expenses = await _sum(session, Expense.amount_mxn, *in_month)
    by_category = dict(
        (
            await session.execute(
                select(Expense.category_id, func.sum(Expense.amount_mxn))
                .where(*in_month)
                .group_by(Expense.category_id)
            )
        ).all()
    )
    categories = list(await session.scalars(select(Category)))
    budgets = {c.id: c.monthly_budget for c in categories if c.monthly_budget}

    rows: list[CategorySpend] = []
    for category_id in set(by_category) | set(budgets):
        spent = Decimal(by_category.get(category_id) or 0)
        budget = budgets.get(category_id) if category_id is not None else None
        rows.append(
            CategorySpend(
                category_id=category_id,
                spent=spent,
                budget=budget,
                ratio=float(spent / budget) if budget else None,
            )
        )
    rows.sort(key=lambda r: r.spent, reverse=True)

    active_fixed = await session.scalars(
        select(RecurringCharge).where(RecurringCharge.active.is_(True))
    )
    return MonthInsights(
        month=month,
        income=income,
        expenses=expenses,
        balance=income - expenses,
        impulse=await _sum(session, Expense.amount_mxn, *in_month, Expense.is_impulse.is_(True)),
        installments=await _sum(
            session, Expense.amount_mxn, *in_month, Expense.installment_plan_id.is_not(None)
        ),
        recurring=await _sum(
            session, Expense.amount_mxn, *in_month, Expense.recurring_id.is_not(None)
        ),
        card_payments=await _sum(
            session, CardPayment.amount, CardPayment.date >= start, CardPayment.date <= end
        ),
        previous_expenses=await _sum(
            session, Expense.amount_mxn, Expense.date >= prev_start, Expense.date <= prev_end
        ),
        fixed_monthly_cost=sum(
            (schedule_costs(c.frequency, c.amount)[0] for c in active_fixed), Decimal(0)
        ),
        budget_total=sum(budgets.values(), Decimal(0)),
        budget_spent=sum((r.spent for r in rows if r.budget), Decimal(0)),
        categories=rows,
    )
