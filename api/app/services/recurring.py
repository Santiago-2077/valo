"""Recurring charges: when they fall due and turning due ones into expenses."""

import calendar
import logging
from collections.abc import Callable
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.models import Expense, Income, RecurringCharge, RecurringIncome
from app.models.recurring import Frequency

__all__ = ["Frequency", "materialize_due", "next_occurrence", "occurrences", "schedule_from"]

log = logging.getLogger(__name__)


def _clamp(year: int, month: int, day: int) -> date:
    return date(year, month, min(day, calendar.monthrange(year, month)[1]))


def next_occurrence(
    on_or_after: date,
    frequency: Frequency,
    day: int,
    month: int | None = None,
    second_day: int | None = None,
) -> date:
    """First occurrence >= on_or_after. Days past month end clamp (31 -> Feb 28)."""
    if frequency == Frequency.SEMIMONTHLY:
        if second_day is None or second_day == day:
            raise ValueError("Semimonthly schedules need two different days")
        return min(
            next_occurrence(on_or_after, Frequency.MONTHLY, day),
            next_occurrence(on_or_after, Frequency.MONTHLY, second_day),
        )

    if frequency == Frequency.MONTHLY:
        candidate = _clamp(on_or_after.year, on_or_after.month, day)
        if candidate >= on_or_after:
            return candidate
        year, mon = (
            (on_or_after.year + 1, 1)
            if on_or_after.month == 12
            else (on_or_after.year, on_or_after.month + 1)
        )
        return _clamp(year, mon, day)

    if month is None:
        raise ValueError("Yearly charges need a month")
    candidate = _clamp(on_or_after.year, month, day)
    return candidate if candidate >= on_or_after else _clamp(on_or_after.year + 1, month, day)


def occurrences(
    start: date,
    end: date,
    frequency: Frequency,
    day: int,
    month: int | None = None,
    second_day: int | None = None,
) -> list[date]:
    """All occurrence dates in [start, end]."""
    result = []
    current = next_occurrence(start, frequency, day, month, second_day)
    while current <= end:
        result.append(current)
        current = next_occurrence(current + timedelta(days=1), frequency, day, month, second_day)
    return result


Scheduled = RecurringCharge | RecurringIncome


def schedule_from(item: Scheduled, on_or_after: date) -> date:
    return next_occurrence(
        on_or_after, item.frequency, item.day_of_month, item.month_of_year, item.second_day
    )


ESTIMATE_NOTE = "Monto estimado: ajustalo cuando llegue el recibo."
INCOME_ESTIMATE_NOTE = "Monto estimado: ajustalo con lo que te depositaron."


def _expense_for(charge: RecurringCharge, day: date) -> Expense:
    return Expense(
        date=day,
        description=charge.name,
        amount=charge.amount,
        currency=charge.currency,
        fx_rate=Decimal(1),
        amount_mxn=charge.amount,
        card_id=charge.card_id,
        category_id=charge.category_id,
        is_impulse=False,
        note=ESTIMATE_NOTE if charge.amount_is_estimate else None,
        recurring_id=charge.id,
    )


def _income_for(source: RecurringIncome, day: date) -> Income:
    return Income(
        date=day,
        description=source.name,
        amount=source.amount,
        kind=source.kind,
        account_id=source.account_id,
        note=INCOME_ESTIMATE_NOTE if source.amount_is_estimate else None,
        recurring_income_id=source.id,
    )


async def _materialize[T: (RecurringCharge, RecurringIncome)](
    session: AsyncSession,
    today: date,
    model: type[T],
    link: InstrumentedAttribute[int | None],
    date_col: InstrumentedAttribute[date],
    build: Callable[[T, date], Expense | Income],
) -> int:
    due = await session.scalars(
        select(model).where(model.active.is_(True), model.next_run <= today)
    )
    created = 0
    for item in due:
        dates = occurrences(
            item.next_run,
            today,
            item.frequency,
            item.day_of_month,
            item.month_of_year,
            item.second_day,
        )
        # Rows may already exist if a previous run crashed before saving next_run.
        existing = set(
            await session.scalars(select(date_col).where(link == item.id, date_col.in_(dates)))
        )
        for day in dates:
            if day not in existing:
                session.add(build(item, day))
                created += 1
        item.next_run = schedule_from(item, today + timedelta(days=1))
    return created


async def materialize_due(session: AsyncSession, today: date) -> int:
    """Record every due recurring charge and income up to today. Safe to run repeatedly."""
    created = await _materialize(
        session, today, RecurringCharge, Expense.recurring_id, Expense.date, _expense_for
    )
    created += await _materialize(
        session,
        today,
        RecurringIncome,
        Income.recurring_income_id,
        Income.date,
        _income_for,
    )
    await session.commit()
    if created:
        log.info("Materialized %d recurring rows", created)
    return created
