"""Monthly installment plans ("meses sin intereses").

A plan of N months becomes N charges, one per consecutive billing cycle starting with
the cycle the purchase falls in. The first charge keeps the purchase date; the rest are
dated on their cycle's closing date, which is when the bank posts them.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_DOWN, Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Card, Expense, InstallmentPlan
from app.schemas import InstallmentRef
from app.services.billing import Statement, statement_for

CENT = Decimal("0.01")


def split_amount(total: Decimal, n: int) -> list[Decimal]:
    """Split into n equal parts truncated to cents; the last part absorbs the remainder."""
    if n < 1:
        raise ValueError("n must be >= 1")
    base = (total / n).quantize(CENT, rounding=ROUND_DOWN)
    return [base] * (n - 1) + [total - base * (n - 1)]


@dataclass(frozen=True)
class Installment:
    number: int
    date: date
    amount: Decimal
    statement: Statement


def schedule(
    total: Decimal, n_months: int, purchase_date: date, closing_day: int, due_day: int
) -> list[Installment]:
    statement = statement_for(purchase_date, closing_day, due_day)
    charges = []
    for number, amount in enumerate(split_amount(total, n_months), start=1):
        charge_date = purchase_date if number == 1 else statement.closing_date
        charges.append(Installment(number, charge_date, amount, statement))
        statement = statement.next(closing_day, due_day)
    return charges


def plan_schedule(plan: InstallmentPlan, card: Card) -> list[Installment]:
    if card.closing_day is None or card.due_day is None:
        raise ValueError("Installment plans need a credit card")
    return schedule(plan.total, plan.n_months, plan.purchase_date, card.closing_day, card.due_day)


async def regenerate_charges(session: AsyncSession, plan: InstallmentPlan, card: Card) -> None:
    """Replace the plan's charges with a fresh schedule. Caller commits."""
    if plan.id is not None:
        await session.execute(delete(Expense).where(Expense.installment_plan_id == plan.id))
    await session.flush()
    for charge in plan_schedule(plan, card):
        session.add(
            Expense(
                date=charge.date,
                description=plan.description,
                amount=charge.amount,
                currency="MXN",
                fx_rate=Decimal(1),
                amount_mxn=charge.amount,
                card_id=plan.card_id,
                category_id=plan.category_id,
                is_impulse=plan.is_impulse,
                note=plan.note,
                installment_plan_id=plan.id,
                installment_number=charge.number,
            )
        )


async def installment_refs(
    session: AsyncSession, expenses: Iterable[Expense]
) -> dict[int, InstallmentRef]:
    """Map expense id -> "n of N" for the expenses that are installment charges."""
    linked = [e for e in expenses if e.installment_plan_id is not None]
    if not linked:
        return {}
    plan_ids = {e.installment_plan_id for e in linked}
    result = await session.execute(
        select(InstallmentPlan.id, InstallmentPlan.n_months).where(InstallmentPlan.id.in_(plan_ids))
    )
    months = {plan_id: n for plan_id, n in result.all()}
    return {
        e.id: InstallmentRef(
            plan_id=e.installment_plan_id,
            number=e.installment_number or 0,
            of=months[e.installment_plan_id],
        )
        for e in linked
        if e.installment_plan_id is not None
    }
