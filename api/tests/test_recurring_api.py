import datetime as dt

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Expense
from app.services.recurring import materialize_due
from tests.conftest import CREDIT_CARD


async def _card(client: AsyncClient) -> int:
    return int((await client.post("/api/cards", json=CREDIT_CARD)).json()["id"])


def _netflix(card_id: int, **overrides: object) -> dict[str, object]:
    return {
        "name": "Netflix",
        "kind": "subscription",
        "amount": "299",
        "card_id": card_id,
        "day_of_month": 15,
        **overrides,
    }


async def _expenses(client: AsyncClient) -> list[dict]:  # type: ignore[type-arg]
    return (await client.get("/api/expenses")).json()["items"]  # type: ignore[no-any-return]


async def test_create_schedules_next_without_backfill(
    auth_client: AsyncClient, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    r = await auth_client.post("/api/recurring", json=_netflix(card))
    assert r.status_code == 201
    body = r.json()
    assert body["next_run"] == "2026-10-15"
    assert body["monthly_cost"] == 299.0 and body["yearly_cost"] == 3588.0
    assert await _expenses(auth_client) == []


async def test_starts_on_in_past_logs_this_months_charge(
    auth_client: AsyncClient, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    body = (
        await auth_client.post("/api/recurring", json=_netflix(card, starts_on="2026-09-01"))
    ).json()
    assert body["next_run"] == "2026-10-15"
    assert body["last_charged"] == "2026-09-15"
    [expense] = await _expenses(auth_client)
    assert expense["date"] == "2026-09-15"
    assert expense["recurring_id"] == body["id"]
    assert expense["statement"]["cycle"] == "2026-09"


async def test_catches_up_missed_months_once(
    auth_client: AsyncClient, session: AsyncSession, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    await auth_client.post("/api/recurring", json=_netflix(card))

    # Server was down for months: the job back-fills every missed charge.
    assert await materialize_due(session, dt.date(2027, 1, 20)) == 4
    assert await materialize_due(session, dt.date(2027, 1, 20)) == 0  # idempotent
    dates = sorted(e["date"] for e in await _expenses(auth_client))
    assert dates == ["2026-10-15", "2026-11-15", "2026-12-15", "2027-01-15"]


async def test_materialize_skips_existing_rows_even_if_next_run_is_stale(
    auth_client: AsyncClient, session: AsyncSession, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    rc = (
        await auth_client.post("/api/recurring", json=_netflix(card, starts_on="2026-09-01"))
    ).json()
    from app.models import RecurringCharge

    charge = await session.get(RecurringCharge, rc["id"])
    assert charge is not None
    charge.next_run = dt.date(2026, 9, 1)  # simulate a crash before next_run was saved
    await session.commit()
    assert await materialize_due(session, dt.date(2026, 9, 30)) == 0
    count = await session.scalar(select(func.count()).select_from(Expense))
    assert count == 1


async def test_yearly(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    bad = await auth_client.post(
        "/api/recurring", json=_netflix(card, frequency="yearly", name="Amazon Prime")
    )
    assert bad.status_code == 422
    body = (
        await auth_client.post(
            "/api/recurring",
            json=_netflix(
                card, frequency="yearly", month_of_year=3, amount="899", name="Amazon Prime"
            ),
        )
    ).json()
    assert body["next_run"] == "2027-03-15"
    assert body["monthly_cost"] == 74.92 and body["yearly_cost"] == 899.0


async def test_pause_and_resume_skips_paused_period(
    auth_client: AsyncClient, session: AsyncSession, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    rc = (await auth_client.post("/api/recurring", json=_netflix(card))).json()
    await auth_client.put(f"/api/recurring/{rc['id']}", json=_netflix(card, active=False))
    assert await materialize_due(session, dt.date(2026, 12, 31)) == 0

    freeze_today(dt.date(2027, 1, 2))
    resumed = (
        await auth_client.put(f"/api/recurring/{rc['id']}", json=_netflix(card, active=True))
    ).json()
    assert resumed["next_run"] == "2027-01-15"
    assert await _expenses(auth_client) == []


async def test_changing_day_reschedules(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    rc = (await auth_client.post("/api/recurring", json=_netflix(card))).json()
    moved = (
        await auth_client.put(f"/api/recurring/{rc['id']}", json=_netflix(card, day_of_month=2))
    ).json()
    assert moved["next_run"] == "2026-10-02"
    renamed = (
        await auth_client.put(
            f"/api/recurring/{rc['id']}", json=_netflix(card, day_of_month=2, name="Netflix 4K")
        )
    ).json()
    assert renamed["next_run"] == "2026-10-02"


async def test_estimate_note_and_delete_keeps_expenses(
    auth_client: AsyncClient, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    rc = (
        await auth_client.post(
            "/api/recurring",
            json=_netflix(
                card,
                name="CFE",
                kind="service",
                amount="640",
                amount_is_estimate=True,
                starts_on="2026-09-01",
            ),
        )
    ).json()
    [expense] = await _expenses(auth_client)
    assert "estimado" in expense["note"]

    assert (await auth_client.delete(f"/api/recurring/{rc['id']}")).status_code == 204
    [kept] = await _expenses(auth_client)
    assert kept["id"] == expense["id"] and kept["recurring_id"] is None


async def test_run_endpoint(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    await auth_client.post("/api/recurring", json=_netflix(card))
    freeze_today(dt.date(2026, 10, 15))
    assert (await auth_client.post("/api/recurring/run")).json() == {"created": 1}
    assert (await auth_client.post("/api/recurring/run")).json() == {"created": 0}
