import datetime as dt
import enum
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.recurring import ScheduleMixin, str_enum


class IncomeKind(enum.StrEnum):
    SALARY = "salary"
    FREELANCE = "freelance"
    BONUS = "bonus"
    OTHER = "other"


class RecurringIncome(ScheduleMixin, TimestampMixin, Base):
    """Fixed income (salary, rent received…) recorded automatically on each pay date."""

    __tablename__ = "recurring_incomes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[IncomeKind] = mapped_column(str_enum(IncomeKind))
    # Where it lands (a debit account or cash). Optional: informational for now.
    account_id: Mapped[int | None] = mapped_column(ForeignKey("cards.id", ondelete="SET NULL"))


class Income(TimestampMixin, Base):
    __tablename__ = "incomes"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        UniqueConstraint("recurring_income_id", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[dt.date] = mapped_column(index=True)
    description: Mapped[str] = mapped_column(String(120))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    kind: Mapped[IncomeKind] = mapped_column(str_enum(IncomeKind))
    account_id: Mapped[int | None] = mapped_column(ForeignKey("cards.id", ondelete="SET NULL"))
    note: Mapped[str | None] = mapped_column(Text)
    recurring_income_id: Mapped[int | None] = mapped_column(
        ForeignKey("recurring_incomes.id", ondelete="SET NULL"), index=True
    )
