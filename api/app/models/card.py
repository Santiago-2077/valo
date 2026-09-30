import enum
from decimal import Decimal

from sqlalchemy import CheckConstraint, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CardKind(enum.StrEnum):
    CREDIT = "credit"
    DEBIT = "debit"
    CASH = "cash"


class Card(TimestampMixin, Base):
    """A payment method. Only credit cards have billing cycles."""

    __tablename__ = "cards"
    __table_args__ = (
        CheckConstraint(
            "kind != 'credit' OR (closing_day BETWEEN 1 AND 31 AND due_day BETWEEN 1 AND 31)",
            name="credit_has_cycle",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    bank: Mapped[str | None] = mapped_column(String(60))
    last4: Mapped[str | None] = mapped_column(String(4))
    kind: Mapped[CardKind] = mapped_column(
        Enum(CardKind, native_enum=False, length=10, values_callable=lambda e: [m.value for m in e])
    )
    closing_day: Mapped[int | None]
    due_day: Mapped[int | None]
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    color: Mapped[str] = mapped_column(String(7), default="#44403c")
    active: Mapped[bool] = mapped_column(default=True)
