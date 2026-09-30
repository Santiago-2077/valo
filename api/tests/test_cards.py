import datetime as dt

from httpx import AsyncClient

from tests.conftest import CREDIT_CARD


async def test_requires_auth(client: AsyncClient) -> None:
    assert (await client.get("/api/cards")).status_code == 401


async def test_credit_card_requires_cycle_days(auth_client: AsyncClient) -> None:
    r = await auth_client.post("/api/cards", json={**CREDIT_CARD, "closing_day": None})
    assert r.status_code == 422


async def test_debit_card_drops_cycle_fields(auth_client: AsyncClient) -> None:
    r = await auth_client.post(
        "/api/cards", json={"name": "Débito", "kind": "debit", "closing_day": 5, "due_day": 9}
    )
    assert r.status_code == 201
    body = r.json()
    assert body["closing_day"] is None and body["current_statement"] is None


async def test_invalid_last4_and_day(auth_client: AsyncClient) -> None:
    assert (
        await auth_client.post("/api/cards", json={**CREDIT_CARD, "last4": "12a4"})
    ).status_code == 422
    assert (
        await auth_client.post("/api/cards", json={**CREDIT_CARD, "closing_day": 32})
    ).status_code == 422


async def test_current_statement_total(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 25))
    card = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()
    assert card["current_statement"]["closing_date"] == "2026-10-20"
    assert card["current_statement"]["due_date"] == "2026-11-10"
    assert card["current_statement"]["total"] == 0

    for day, amount in [("2026-09-20", "100"), ("2026-09-21", "250.50"), ("2026-10-20", "49.50")]:
        r = await auth_client.post(
            "/api/expenses",
            json={"date": day, "description": "x", "amount": amount, "card_id": card["id"]},
        )
        assert r.status_code == 201

    cards = (await auth_client.get("/api/cards")).json()
    assert cards[0]["current_statement"]["total"] == 300.0
    assert cards[0]["credit_limit"] == 45000.0


async def test_statement_detail_and_navigation(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 10, 1))
    card = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()
    for day, impulse in [("2026-09-10", True), ("2026-09-15", False), ("2026-09-25", False)]:
        await auth_client.post(
            "/api/expenses",
            json={
                "date": day,
                "description": day,
                "amount": "100",
                "card_id": card["id"],
                "is_impulse": impulse,
            },
        )

    sept = (await auth_client.get(f"/api/cards/{card['id']}/statement?cycle=2026-09")).json()
    assert sept["status"] == "closed"  # closed Sep 20, due Oct 10, today Oct 1
    assert [e["description"] for e in sept["expenses"]] == ["2026-09-15", "2026-09-10"]
    assert sept["total"] == 200.0 and sept["impulse_total"] == 100.0
    assert (sept["previous_cycle"], sept["next_cycle"]) == ("2026-08", "2026-10")

    current = (await auth_client.get(f"/api/cards/{card['id']}/statement")).json()
    assert current["cycle"] == "2026-10" and current["status"] == "open"
    assert current["total"] == 100.0

    aug = (await auth_client.get(f"/api/cards/{card['id']}/statement?cycle=2026-08")).json()
    assert aug["status"] == "past_due_date"


async def test_statement_rejects_bad_cycle_and_debit(auth_client: AsyncClient) -> None:
    card = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()
    r = await auth_client.get(f"/api/cards/{card['id']}/statement?cycle=2026-13")
    assert r.status_code == 422
    debit = (await auth_client.post("/api/cards", json={"name": "D", "kind": "cash"})).json()
    assert (await auth_client.get(f"/api/cards/{debit['id']}/statement")).status_code == 400


async def test_update_card(auth_client: AsyncClient) -> None:
    card = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()
    r = await auth_client.put(
        f"/api/cards/{card['id']}", json={**CREDIT_CARD, "closing_day": 5, "active": False}
    )
    assert r.json()["closing_day"] == 5 and r.json()["active"] is False


async def test_delete_card_blocked_when_it_has_expenses(auth_client: AsyncClient) -> None:
    card = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()
    await auth_client.post(
        "/api/expenses",
        json={"date": "2026-09-01", "description": "x", "amount": "1", "card_id": card["id"]},
    )
    assert (await auth_client.delete(f"/api/cards/{card['id']}")).status_code == 409
    empty = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()
    assert (await auth_client.delete(f"/api/cards/{empty['id']}")).status_code == 204


async def test_pending_statement_between_closing_and_due(
    auth_client: AsyncClient, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    card = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()
    for day, amount in [("2026-09-15", "700"), ("2026-09-25", "40")]:
        await auth_client.post(
            "/api/expenses",
            json={"date": day, "description": "x", "amount": amount, "card_id": card["id"]},
        )

    # Sep 30: September closed on the 20th, due Oct 10 -> still pending.
    freeze_today(dt.date(2026, 9, 30))
    out = (await auth_client.get(f"/api/cards/{card['id']}")).json()
    assert out["pending_statement"]["cycle"] == "2026-09"
    assert out["pending_statement"]["total"] == 700.0
    assert out["pending_statement"]["due_date"] == "2026-10-10"
    assert out["current_statement"]["total"] == 40.0

    # Due date itself: still pending.
    freeze_today(dt.date(2026, 10, 10))
    assert (await auth_client.get(f"/api/cards/{card['id']}")).json()["pending_statement"]

    # Day after due date: gone.
    freeze_today(dt.date(2026, 10, 11))
    assert (await auth_client.get(f"/api/cards/{card['id']}")).json()["pending_statement"] is None


async def test_no_pending_when_due_before_next_closing(
    auth_client: AsyncClient, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    card = (
        await auth_client.post("/api/cards", json={**CREDIT_CARD, "closing_day": 5, "due_day": 25})
    ).json()
    freeze_today(dt.date(2026, 9, 28))  # Sep cycle closed 5th, paid by 25th
    out = (await auth_client.get(f"/api/cards/{card['id']}")).json()
    assert out["pending_statement"] is None
    freeze_today(dt.date(2026, 9, 20))
    out = (await auth_client.get(f"/api/cards/{card['id']}")).json()
    assert out["pending_statement"]["due_date"] == "2026-09-25"
