import datetime as dt
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.card import Card
from app.models.category import Category


class Expense(TimestampMixin, Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        Index("ix_expenses_card_date", "card_id", "date"),
        UniqueConstraint("installment_plan_id", "installment_number"),
        # One charge per recurring item per date: makes the daily job safe to re-run.
        UniqueConstraint("recurring_id", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[dt.date] = mapped_column(index=True)
    description: Mapped[str] = mapped_column(String(120))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="MXN")
    fx_rate: Mapped[Decimal] = mapped_column(Numeric(14, 6), default=Decimal(1))
    # Amount in base currency, frozen at creation so totals never drift with FX.
    amount_mxn: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="RESTRICT"))
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL")
    )
    is_impulse: Mapped[bool] = mapped_column(default=False)
    note: Mapped[str | None] = mapped_column(Text)
    installment_plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("installment_plans.id", ondelete="CASCADE"), index=True
    )
    installment_number: Mapped[int | None]
    recurring_id: Mapped[int | None] = mapped_column(
        ForeignKey("recurring_charges.id", ondelete="SET NULL"), index=True
    )

    card: Mapped[Card] = relationship(lazy="raise")
    category: Mapped[Category | None] = relationship(lazy="raise")
