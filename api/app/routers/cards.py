from datetime import date
from decimal import Decimal
from typing import Annotated, Literal, Self

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import delete, exists, select

from app.clock import today
from app.deps import CurrentUser, SessionDep
from app.models import Card, CardKind, CardPayment, Expense, StatementCheck
from app.schemas import HexColor, InstallmentRef, Money, MoneyIn, ORMModel, StatementRef
from app.services.billing import Statement, parse_cycle
from app.services.cards import (
    amount_owed,
    bank_total_for,
    card_cycle,
    card_statement_for,
    paid_for,
    to_ref,
    total_between,
)
from app.services.installments import installment_refs

router = APIRouter(prefix="/cards", tags=["cards"])

Day = Annotated[int, Field(ge=1, le=31)]


class CardIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    bank: str | None = Field(default=None, max_length=60)
    last4: str | None = Field(default=None, pattern=r"^\d{4}$")
    kind: CardKind
    closing_day: Day | None = None
    due_day: Day | None = None
    credit_limit: MoneyIn | None = None
    color: HexColor = "#44403c"
    active: bool = True

    @model_validator(mode="after")
    def _cycle_only_for_credit(self) -> Self:
        if self.kind == CardKind.CREDIT:
            if self.closing_day is None or self.due_day is None:
                raise ValueError("Las tarjetas de crédito necesitan día de corte y de pago")
        else:
            self.closing_day = self.due_day = self.credit_limit = None
        return self


class CurrentStatement(StatementRef):
    total: Money
    paid: Money
    remaining: Money


class CardOut(ORMModel):
    id: int
    name: str
    bank: str | None
    last4: str | None
    kind: CardKind
    closing_day: int | None
    due_day: int | None
    credit_limit: Money | None
    color: str
    active: bool
    current_statement: CurrentStatement | None = None
    # Last closed statement whose payment is still due (the one to pay now).
    pending_statement: CurrentStatement | None = None


class StatementExpense(ORMModel):
    id: int
    date: date
    description: str
    amount: Money
    currency: str
    amount_mxn: Money
    category_id: int | None
    is_impulse: bool
    recurring_id: int | None = None
    installment: InstallmentRef | None = None


class PaymentIn(BaseModel):
    date: date
    amount: MoneyIn
    # Statement being paid; defaults to the one currently due (or the open one).
    cycle: Annotated[str | None, Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")] = None
    note: str | None = Field(default=None, max_length=2000)


class PaymentOut(ORMModel):
    id: int
    card_id: int
    cycle: str
    date: date
    amount: Money
    note: str | None


class CheckIn(BaseModel):
    bank_total: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]


class StatementDetail(StatementRef):
    card_id: int
    status: Literal["open", "closed", "past_due_date"]
    total: Money
    paid: Money
    remaining: Money  # owed (bank total if reconciled, else logged total) minus paid
    settled: bool  # paid in full
    # Reconciliation: bank_total - total. Positive = the bank shows charges you didn't log.
    bank_total: Money | None
    difference: Money | None
    payments: list[PaymentOut]
    impulse_total: Money
    previous_cycle: str
    next_cycle: str
    expenses: list[StatementExpense]


async def _get_card(session: SessionDep, card_id: int) -> Card:
    card = await session.get(Card, card_id)
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarjeta no encontrada")
    return card


async def _with_total(session: SessionDep, card: Card, statement: Statement) -> CurrentStatement:
    total = await total_between(session, card.id, statement.period_start, statement.closing_date)
    paid = await paid_for(session, card.id, statement.cycle)
    owed = amount_owed(total, await bank_total_for(session, card.id, statement.cycle))
    return CurrentStatement(
        **to_ref(statement).model_dump(),
        total=total,
        paid=paid,
        remaining=max(owed - paid, Decimal(0)),
    )


async def _to_out(session: SessionDep, card: Card) -> CardOut:
    out = CardOut.model_validate(card)
    now = today()
    statement = card_statement_for(card, now)
    if statement is None or card.closing_day is None or card.due_day is None:
        return out
    out.current_statement = await _with_total(session, card, statement)
    previous = statement.previous(card.closing_day, card.due_day)
    if now <= previous.due_date:
        pending = await _with_total(session, card, previous)
        # Once it's fully paid there's nothing pending anymore.
        out.pending_statement = pending if pending.remaining > 0 or pending.total == 0 else None
    return out


@router.get("", response_model=list[CardOut])
async def list_cards(session: SessionDep, _: CurrentUser) -> list[CardOut]:
    cards = await session.scalars(select(Card).order_by(Card.active.desc(), Card.name))
    return [await _to_out(session, c) for c in cards]


@router.post("", response_model=CardOut, status_code=status.HTTP_201_CREATED)
async def create_card(data: CardIn, session: SessionDep, _: CurrentUser) -> CardOut:
    card = Card(**data.model_dump())
    session.add(card)
    await session.commit()
    return await _to_out(session, card)


@router.get("/{card_id}", response_model=CardOut)
async def get_card(card_id: int, session: SessionDep, _: CurrentUser) -> CardOut:
    return await _to_out(session, await _get_card(session, card_id))


@router.put("/{card_id}", response_model=CardOut)
async def update_card(card_id: int, data: CardIn, session: SessionDep, _: CurrentUser) -> CardOut:
    card = await _get_card(session, card_id)
    for key, value in data.model_dump().items():
        setattr(card, key, value)
    await session.commit()
    return await _to_out(session, card)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(card_id: int, session: SessionDep, _: CurrentUser) -> None:
    card = await _get_card(session, card_id)
    if await session.scalar(select(exists().where(Expense.card_id == card_id))):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "La tarjeta tiene gastos; desactivala en lugar de borrarla"
        )
    # Explicit instead of relying on ON DELETE CASCADE, so it also holds on SQLite.
    await session.execute(delete(CardPayment).where(CardPayment.card_id == card_id))
    await session.execute(delete(StatementCheck).where(StatementCheck.card_id == card_id))
    await session.delete(card)
    await session.commit()


@router.get("/{card_id}/statement", response_model=StatementDetail)
async def get_statement(
    card_id: int,
    session: SessionDep,
    _: CurrentUser,
    cycle: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
) -> StatementDetail:
    """A billing cycle of a credit card. Defaults to the cycle open today."""
    card = await _get_card(session, card_id)
    if cycle is None:
        statement = card_statement_for(card, today())
    else:
        try:
            statement = card_cycle(card, *parse_cycle(cycle))
        except ValueError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    if statement is None or card.closing_day is None or card.due_day is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Solo las tarjetas de crédito tienen corte"
        )

    rows = list(
        await session.scalars(
            select(Expense)
            .where(
                Expense.card_id == card.id,
                Expense.date >= statement.period_start,
                Expense.date <= statement.closing_date,
            )
            .order_by(Expense.date.desc(), Expense.id.desc())
        )
    )
    refs = await installment_refs(session, rows)
    now = today()
    state: Literal["open", "closed", "past_due_date"] = (
        "open"
        if now <= statement.closing_date
        else "closed"
        if now <= statement.due_date
        else "past_due_date"
    )
    total = sum((e.amount_mxn for e in rows), Decimal(0))
    payments = list(
        await session.scalars(
            select(CardPayment)
            .where(CardPayment.card_id == card.id, CardPayment.cycle == statement.cycle)
            .order_by(CardPayment.date)
        )
    )
    paid = sum((p.amount for p in payments), Decimal(0))
    bank_total = await bank_total_for(session, card.id, statement.cycle)
    return StatementDetail(
        **to_ref(statement).model_dump(),
        card_id=card.id,
        status=state,
        total=total,
        paid=paid,
        remaining=max(amount_owed(total, bank_total) - paid, Decimal(0)),
        settled=amount_owed(total, bank_total) > 0 and paid >= amount_owed(total, bank_total),
        bank_total=bank_total,
        difference=bank_total - total if bank_total is not None else None,
        payments=[PaymentOut.model_validate(p) for p in payments],
        impulse_total=sum((e.amount_mxn for e in rows if e.is_impulse), Decimal(0)),
        previous_cycle=statement.previous(card.closing_day, card.due_day).cycle,
        next_cycle=statement.next(card.closing_day, card.due_day).cycle,
        expenses=[
            StatementExpense.model_validate(e).model_copy(update={"installment": refs.get(e.id)})
            for e in rows
        ],
    )


async def _credit(session: SessionDep, card_id: int) -> Card:
    card = await _get_card(session, card_id)
    if card.kind != CardKind.CREDIT or card.closing_day is None or card.due_day is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Solo las tarjetas de crédito tienen corte"
        )
    return card


def _valid_cycle(cycle: str) -> str:
    try:
        parse_cycle(cycle)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    return cycle


@router.get("/{card_id}/payments", response_model=list[PaymentOut])
async def list_payments(card_id: int, session: SessionDep, _: CurrentUser) -> list[CardPayment]:
    await _get_card(session, card_id)
    return list(
        await session.scalars(
            select(CardPayment)
            .where(CardPayment.card_id == card_id)
            .order_by(CardPayment.date.desc(), CardPayment.id.desc())
        )
    )


@router.post("/{card_id}/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def create_payment(
    card_id: int, data: PaymentIn, session: SessionDep, _: CurrentUser
) -> CardPayment:
    """Record a payment toward a statement. It's a transfer, not an expense."""
    card = await _credit(session, card_id)
    cycle = data.cycle
    if cycle is None:
        out = await _to_out(session, card)
        target = out.pending_statement or out.current_statement
        assert target is not None
        cycle = target.cycle
    payment = CardPayment(
        card_id=card.id,
        cycle=_valid_cycle(cycle),
        date=data.date,
        amount=data.amount,
        note=data.note,
    )
    session.add(payment)
    await session.commit()
    return payment


@router.delete("/{card_id}/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    card_id: int, payment_id: int, session: SessionDep, _: CurrentUser
) -> None:
    payment = await session.get(CardPayment, payment_id)
    if payment is None or payment.card_id != card_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pago no encontrado")
    await session.delete(payment)
    await session.commit()


@router.put("/{card_id}/statement/{cycle}/check", status_code=status.HTTP_204_NO_CONTENT)
async def set_check(
    card_id: int, cycle: str, data: CheckIn, session: SessionDep, _: CurrentUser
) -> None:
    """Store the total printed on the bank statement for this cycle."""
    await _credit(session, card_id)
    _valid_cycle(cycle)
    check = await session.scalar(
        select(StatementCheck).where(
            StatementCheck.card_id == card_id, StatementCheck.cycle == cycle
        )
    )
    if check is None:
        session.add(StatementCheck(card_id=card_id, cycle=cycle, bank_total=data.bank_total))
    else:
        check.bank_total = data.bank_total
    await session.commit()


@router.delete("/{card_id}/statement/{cycle}/check", status_code=status.HTTP_204_NO_CONTENT)
async def clear_check(card_id: int, cycle: str, session: SessionDep, _: CurrentUser) -> None:
    await session.execute(
        delete(StatementCheck).where(
            StatementCheck.card_id == card_id, StatementCheck.cycle == cycle
        )
    )
    await session.commit()
