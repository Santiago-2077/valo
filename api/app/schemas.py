from datetime import date
from decimal import Decimal
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, model_validator

from app.models.recurring import Frequency

# Money is stored and summed as Decimal; JSON gets a plain number for easy client use.
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
MoneyIn = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
HexColor = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class StatementRef(BaseModel):
    cycle: str
    period_start: date
    closing_date: date
    due_date: date


class InstallmentRef(BaseModel):
    plan_id: int
    number: int
    of: int


class ScheduleIn(BaseModel):
    """Repetition fields shared by recurring charges and recurring incomes."""

    frequency: Frequency = Frequency.MONTHLY
    day_of_month: Annotated[int, Field(ge=1, le=31)]
    second_day: Annotated[int | None, Field(ge=1, le=31)] = None
    month_of_year: Annotated[int | None, Field(ge=1, le=12)] = None
    amount: MoneyIn
    amount_is_estimate: bool = False
    active: bool = True
    # First date to consider when creating. Set it in the past to log this period too.
    starts_on: date | None = None

    @model_validator(mode="after")
    def _schedule_fields(self) -> Self:
        if self.frequency == Frequency.YEARLY and self.month_of_year is None:
            raise ValueError("Los cobros anuales necesitan el mes")
        if self.frequency == Frequency.SEMIMONTHLY and (
            self.second_day is None or self.second_day == self.day_of_month
        ):
            raise ValueError("La frecuencia quincenal necesita dos días distintos")
        if self.frequency != Frequency.YEARLY:
            self.month_of_year = None
        if self.frequency != Frequency.SEMIMONTHLY:
            self.second_day = None
        return self


SCHEDULE_FIELDS = ("frequency", "day_of_month", "second_day", "month_of_year")


def schedule_costs(frequency: Frequency, amount: Decimal) -> tuple[Decimal, Decimal]:
    """(monthly, yearly) equivalents of a recurring amount."""
    if frequency == Frequency.YEARLY:
        return (amount / 12).quantize(Decimal("0.01")), amount
    per_month = amount * 2 if frequency == Frequency.SEMIMONTHLY else amount
    return per_month, per_month * 12
