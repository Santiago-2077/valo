import datetime as dt
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CardPayment(TimestampMixin, Base):
    """Money paid toward a credit card statement. A transfer, never counted as spending."""

    __tablename__ = "card_payments"
    __table_args__ = (CheckConstraint("amount > 0", name="amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), index=True)
    cycle: Mapped[str] = mapped_column(String(7))  # statement it pays, YYYY-MM
    date: Mapped[dt.date]
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    note: Mapped[str | None] = mapped_column(Text)


class StatementCheck(TimestampMixin, Base):
    """The total printed on the bank's statement, to reconcile against what was logged."""

    __tablename__ = "statement_checks"
    __table_args__ = (UniqueConstraint("card_id", "cycle"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"))
    cycle: Mapped[str] = mapped_column(String(7))
    bank_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
