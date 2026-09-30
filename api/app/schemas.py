from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer

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
