from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Card, CardKind, Expense
from app.schemas import StatementRef
from app.services.billing import Statement, cycle_for, statement_for


def card_statement_for(card: Card, day: date) -> Statement | None:
    if card.kind != CardKind.CREDIT or card.closing_day is None or card.due_day is None:
        return None
    return statement_for(day, card.closing_day, card.due_day)


def card_cycle(card: Card, year: int, month: int) -> Statement | None:
    if card.kind != CardKind.CREDIT or card.closing_day is None or card.due_day is None:
        return None
    return cycle_for(year, month, card.closing_day, card.due_day)


def to_ref(statement: Statement) -> StatementRef:
    return StatementRef(
        cycle=statement.cycle,
        period_start=statement.period_start,
        closing_date=statement.closing_date,
        due_date=statement.due_date,
    )


async def total_between(session: AsyncSession, card_id: int, start: date, end: date) -> Decimal:
    total = await session.scalar(
        select(func.coalesce(func.sum(Expense.amount_mxn), 0)).where(
            Expense.card_id == card_id, Expense.date >= start, Expense.date <= end
        )
    )
    return Decimal(total or 0)
