import datetime as dt

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.demo import BUDGETS, is_empty, seed_demo


async def test_seed_demo_builds_a_coherent_month(
    auth_client: AsyncClient, session: AsyncSession, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    today = dt.date(2026, 9, 30)
    freeze_today(today)
    assert await is_empty(session)
    counts = await seed_demo(session, today)
    assert counts["tarjetas"] == 4 and counts["gastos"] > 60 and counts["ingresos"] >= 6
    assert not await is_empty(session)

    month = (await auth_client.get("/api/insights/month")).json()
    assert month["income"] > 0 and month["expenses"] > 0
    assert month["budget_total"] == float(sum(BUDGETS.values()))
    assert month["installments"] > 0 and month["recurring"] > 0

    cards = {c["name"]: c for c in (await auth_client.get("/api/cards")).json()}
    pending = cards["Oro"]["pending_statement"]
    assert pending["paid"] > 0 and pending["remaining"] > 0
    st = (
        await auth_client.get(f"/api/cards/{cards['Oro']['id']}/statement?cycle={pending['cycle']}")
    ).json()
    assert st["difference"] == 39.4  # the unlogged commission

    plans = (await auth_client.get("/api/installments")).json()
    assert {p["description"] for p in plans} == {"MacBook Air", "PS5 Pro"}
    assert len((await auth_client.get("/api/recurring")).json()) == 6
