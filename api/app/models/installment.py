import datetime as dt
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class InstallmentPlan(TimestampMixin, Base):
    """A purchase paid in monthly installments. Its charges live in `expenses`."""

    __tablename__ = "installment_plans"
    __table_args__ = (
        CheckConstraint("total > 0", name="total_positive"),
        CheckConstraint("n_months BETWEEN 2 AND 48", name="n_months_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    description: Mapped[str] = mapped_column(String(120))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    n_months: Mapped[int]
    interest_free: Mapped[bool] = mapped_column(default=True)
    purchase_date: Mapped[dt.date]
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="RESTRICT"))
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL")
    )
    is_impulse: Mapped[bool] = mapped_column(default=False)
    note: Mapped[str | None] = mapped_column(Text)
