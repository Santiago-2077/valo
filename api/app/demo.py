"""Realistic demo data relative to a given day, for trying Valo and taking screenshots."""

import random
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bootstrap import ensure_default_categories
from app.models import (
    Card,
    CardKind,
    CardPayment,
    Category,
    Expense,
    Frequency,
    Income,
    IncomeKind,
    InstallmentPlan,
    RecurringCharge,
    RecurringIncome,
    RecurringKind,
    StatementCheck,
)
from app.services.billing import statement_for
from app.services.cards import total_between
from app.services.installments import regenerate_charges
from app.services.recurring import materialize_due, schedule_from

BUDGETS = {
    "Comida": 3500,
    "Súper": 5500,
    "Transporte": 2200,
    "Entretenimiento": 2500,
    "Ropa": 1500,
}

# (description, category, card key, min, max, impulse, every_n_days)
SPENDING = [
    ("Tacos El Güero", "Comida", "cash", 110, 260, False, 8),
    ("Café Punta del Cielo", "Comida", "cash", 55, 90, False, 6),
    ("Rappi", "Comida", "nu", 220, 380, True, 12),
    ("Walmart despensa", "Súper", "oro", 750, 1350, False, 9),
    ("Costco", "Súper", "oro", 1600, 2400, False, 30),
    ("Uber", "Transporte", "nu", 80, 150, False, 7),
    ("Gasolina", "Transporte", "oro", 650, 850, False, 14),
    ("Cinépolis", "Entretenimiento", "oro", 260, 380, True, 20),
    ("Bar con amigos", "Entretenimiento", "nu", 380, 650, True, 18),
    ("Ropa Zara", "Ropa", "oro", 700, 1600, True, 40),
    ("Farmacia", "Salud", "debit", 120, 320, False, 25),
]


def _money(rng: random.Random, low: int, high: int) -> Decimal:
    return Decimal(rng.randint(low * 100, high * 100)) / 100


async def is_empty(session: AsyncSession) -> bool:
    return not await session.scalar(select(func.count()).select_from(Card))


async def seed_demo(session: AsyncSession, today: date, days: int = 75) -> dict[str, int]:
    """Create cards, budgets, ~2 months of spending, plans, fixed charges and income."""
    rng = random.Random(7)  # deterministic: same demo every run
    await ensure_default_categories(session)
    categories = {c.name: c for c in await session.scalars(select(Category))}
    for name, budget in BUDGETS.items():
        categories[name].monthly_budget = Decimal(budget)

    cards = {
        "oro": Card(
            name="Oro",
            bank="BBVA",
            last4="4821",
            kind=CardKind.CREDIT,
            closing_day=20,
            due_day=10,
            credit_limit=Decimal(45000),
            color="#1e3a8a",
        ),
        "nu": Card(
            name="Nu",
            bank="Nu",
            last4="0193",
            kind=CardKind.CREDIT,
            closing_day=3,
            due_day=23,
            credit_limit=Decimal(18000),
            color="#6b21a8",
        ),
        "debit": Card(name="Nómina BBVA", bank="BBVA", kind=CardKind.DEBIT, color="#0f766e"),
        "cash": Card(name="Efectivo", kind=CardKind.CASH, color="#475569"),
    }
    session.add_all(cards.values())
    await session.flush()

    start = today - timedelta(days=days)
    for desc, cat, card, low, high, impulse, every in SPENDING:
        day = start + timedelta(days=rng.randint(0, every - 1))
        while day <= today:
            amount = _money(rng, low, high)
            session.add(
                Expense(
                    date=day,
                    description=desc,
                    amount=amount,
                    currency="MXN",
                    fx_rate=Decimal(1),
                    amount_mxn=amount,
                    card_id=cards[card].id,
                    category_id=categories[cat].id,
                    is_impulse=impulse,
                )
            )
            day += timedelta(days=every + rng.randint(-1, 2))

    plans = [
        InstallmentPlan(
            description="MacBook Air",
            total=Decimal(24999),
            n_months=12,
            purchase_date=today - timedelta(days=105),
            card_id=cards["oro"].id,
            category_id=categories["Hogar"].id,
        ),
        InstallmentPlan(
            description="PS5 Pro",
            total=Decimal(15999),
            n_months=12,
            purchase_date=today - timedelta(days=12),
            card_id=cards["nu"].id,
            category_id=categories["Entretenimiento"].id,
            is_impulse=True,
        ),
    ]
    for plan in plans:
        session.add(plan)
        await session.flush()
        plan_card = cards["oro"] if plan.card_id == cards["oro"].id else cards["nu"]
        await regenerate_charges(session, plan, plan_card)

    fixed = [
        ("Netflix Estándar", RecurringKind.SUBSCRIPTION, 299, "oro", "Suscripciones", 15, False),
        ("Spotify Duo", RecurringKind.SUBSCRIPTION, 149, "nu", "Suscripciones", 8, False),
        ("ChatGPT Plus", RecurringKind.SUBSCRIPTION, 399, "oro", "Suscripciones", 2, False),
        ("Smart Fit", RecurringKind.SUBSCRIPTION, 549, "debit", "Salud", 1, False),
        ("Izzi internet", RecurringKind.SERVICE, 549, "oro", "Servicios", 10, False),
        ("CFE luz", RecurringKind.SERVICE, 640, "debit", "Servicios", 28, True),
    ]
    for name, kind, price, card, cat, day_of_month, estimate in fixed:
        charge = RecurringCharge(
            name=name,
            kind=kind,
            amount=Decimal(price),
            amount_is_estimate=estimate,
            card_id=cards[card].id,
            category_id=categories[cat].id,
            frequency=Frequency.MONTHLY,
            day_of_month=day_of_month,
        )
        charge.next_run = schedule_from(charge, start)
        session.add(charge)

    salary = RecurringIncome(
        name="Sueldo",
        kind=IncomeKind.SALARY,
        amount=Decimal(9850),
        account_id=cards["debit"].id,
        frequency=Frequency.SEMIMONTHLY,
        day_of_month=15,
        second_day=31,
    )
    salary.next_run = schedule_from(salary, start)
    session.add(salary)
    for days_ago, desc, paid in [
        (40, "Logo para cafetería", 3500),
        (9, "Landing para un amigo", 2800),
    ]:
        session.add(
            Income(
                date=today - timedelta(days=days_ago),
                description=desc,
                amount=Decimal(paid),
                kind=IncomeKind.FREELANCE,
                account_id=cards["debit"].id,
            )
        )
    await session.flush()
    await materialize_due(session, today)  # commits

    # Card payments: older statements paid in full; the one due now, partially.
    oro = cards["oro"]
    assert oro.closing_day is not None and oro.due_day is not None
    current = statement_for(today, oro.closing_day, oro.due_day)
    pending = current.previous(oro.closing_day, oro.due_day)
    older = pending.previous(oro.closing_day, oro.due_day)
    for st in (older.previous(oro.closing_day, oro.due_day), older):
        total = await total_between(session, oro.id, st.period_start, st.closing_date)
        if total > 0:
            session.add(CardPayment(card_id=oro.id, cycle=st.cycle, date=st.due_date, amount=total))
    pending_total = await total_between(session, oro.id, pending.period_start, pending.closing_date)
    if today > pending.closing_date and pending_total > 0:
        session.add(
            CardPayment(
                card_id=oro.id,
                cycle=pending.cycle,
                date=min(today, pending.closing_date + timedelta(days=5)),
                amount=(pending_total / 3).quantize(Decimal("1")),
            )
        )
        # The bank shows a small commission that wasn't logged: reconciliation finds it.
        session.add(
            StatementCheck(
                card_id=oro.id, cycle=pending.cycle, bank_total=pending_total + Decimal("39.40")
            )
        )
    await session.commit()

    counts = {}
    for label, model in [("gastos", Expense), ("ingresos", Income), ("tarjetas", Card)]:
        counts[label] = await session.scalar(select(func.count()).select_from(model)) or 0
    return counts
