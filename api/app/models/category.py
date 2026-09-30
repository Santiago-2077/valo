from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(40), unique=True)
    icon: Mapped[str] = mapped_column(String(40), default="tag")
    color: Mapped[str] = mapped_column(String(7), default="#78716c")
    monthly_budget: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
