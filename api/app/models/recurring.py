import datetime as dt
import enum
from decimal import Decimal

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column

from app.models.base import Base, TimestampMixin


class Frequency(enum.StrEnum):
    MONTHLY = "monthly"
    SEMIMONTHLY = "semimonthly"  # "quincenal": two fixed days each month
    YEARLY = "yearly"


class RecurringKind(enum.StrEnum):
    SUBSCRIPTION = "subscription"
    SERVICE = "service"


def str_enum(e: type[enum.Enum]) -> Enum:
    return Enum(e, native_enum=False, length=15, values_callable=lambda x: [m.value for m in x])


class ScheduleMixin:
    """When something repeats. Shared by recurring charges and recurring incomes."""

    frequency: Mapped[Frequency] = mapped_column(str_enum(Frequency))
    day_of_month: Mapped[int]
    second_day: Mapped[int | None]  # semimonthly only
    month_of_year: Mapped[int | None]  # yearly only
    active: Mapped[bool] = mapped_column(default=True)
    # Next date to materialize. Everything before it has already been recorded.
    next_run: Mapped[dt.date]
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Utilities and variable pay: the amount is a guess corrected afterwards.
    amount_is_estimate: Mapped[bool] = mapped_column(default=False)

    @declared_attr.directive
    def __table_args__(cls) -> tuple[CheckConstraint, ...]:
        return (
            CheckConstraint("amount > 0", name="amount_positive"),
            CheckConstraint("day_of_month BETWEEN 1 AND 31", name="day_range"),
            CheckConstraint(
                "frequency != 'yearly' OR month_of_year BETWEEN 1 AND 12", name="yearly_has_month"
            ),
            CheckConstraint(
                "frequency != 'semimonthly' OR "
                "(second_day BETWEEN 1 AND 31 AND second_day != day_of_month)",
                name="semimonthly_has_second_day",
            ),
        )


class RecurringCharge(ScheduleMixin, TimestampMixin, Base):
    """A subscription or utility bill that turns into an expense on each due date."""

    __tablename__ = "recurring_charges"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[RecurringKind] = mapped_column(str_enum(RecurringKind))
    currency: Mapped[str] = mapped_column(String(3), default="MXN")
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="RESTRICT"))
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL")
    )
