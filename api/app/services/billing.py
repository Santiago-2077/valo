"""Credit card billing cycles.

A cycle is identified by its closing date (the "corte"). Purchases made on or before
the closing day belong to that month's cycle; later ones roll into the next month.
Days beyond a month's length clamp to its last day (closing on the 31st closes Feb 28).
"""

import calendar
from dataclasses import dataclass
from datetime import date, timedelta


def _clamp(year: int, month: int, day: int) -> date:
    return date(year, month, min(day, calendar.monthrange(year, month)[1]))


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def closing_date(year: int, month: int, closing_day: int) -> date:
    return _clamp(year, month, closing_day)


def _due_date(closing: date, due_day: int) -> date:
    """First occurrence of due_day strictly after the closing date."""
    if due_day > closing.day:
        candidate = _clamp(closing.year, closing.month, due_day)
        if candidate > closing:
            return candidate
    year, month = _shift_month(closing.year, closing.month, 1)
    return _clamp(year, month, due_day)


@dataclass(frozen=True)
class Statement:
    period_start: date
    closing_date: date
    due_date: date

    def contains(self, day: date) -> bool:
        return self.period_start <= day <= self.closing_date

    @property
    def cycle(self) -> str:
        return f"{self.closing_date.year:04d}-{self.closing_date.month:02d}"

    def next(self, closing_day: int, due_day: int) -> "Statement":
        year, month = _shift_month(self.closing_date.year, self.closing_date.month, 1)
        return cycle_for(year, month, closing_day, due_day)

    def previous(self, closing_day: int, due_day: int) -> "Statement":
        year, month = _shift_month(self.closing_date.year, self.closing_date.month, -1)
        return cycle_for(year, month, closing_day, due_day)


def cycle_for(year: int, month: int, closing_day: int, due_day: int) -> Statement:
    """The statement that closes in the given month."""
    closing = closing_date(year, month, closing_day)
    prev_year, prev_month = _shift_month(year, month, -1)
    period_start = closing_date(prev_year, prev_month, closing_day) + timedelta(days=1)
    return Statement(period_start, closing, _due_date(closing, due_day))


def statement_for(day: date, closing_day: int, due_day: int) -> Statement:
    """The statement a purchase made on `day` is billed in."""
    if day <= closing_date(day.year, day.month, closing_day):
        return cycle_for(day.year, day.month, closing_day, due_day)
    year, month = _shift_month(day.year, day.month, 1)
    return cycle_for(year, month, closing_day, due_day)


def parse_cycle(cycle: str) -> tuple[int, int]:
    """Parse a 'YYYY-MM' cycle key."""
    try:
        year_str, month_str = cycle.split("-")
        year, month = int(year_str), int(month_str)
    except ValueError as exc:
        raise ValueError(f"Invalid cycle {cycle!r}, expected YYYY-MM") from exc
    if not 1 <= month <= 12:
        raise ValueError(f"Invalid cycle {cycle!r}, expected YYYY-MM")
    return year, month
