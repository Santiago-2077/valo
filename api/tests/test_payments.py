import datetime as dt

from httpx import AsyncClient

from tests.conftest import CREDIT_CARD


async def _setup(client: AsyncClient) -> int:
    card = int((await client.post("/api/cards", json=CREDIT_CARD)).json()["id"])
    for day, amount in [("2026-09-10", "1000"), ("2026-09-15", "500.50"), ("2026-09-25", "80")]:
        await client.post(
            "/api/expenses",
            json={"date": day, "description": "x", "amount": amount, "card_id": card},
        )
    return card


async def test_payment_defaults_to_pending_statement(
    auth_client: AsyncClient, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _setup(auth_client)
    r = await auth_client.post(
        f"/api/cards/{card}/payments", json={"date": "2026-09-30", "amount": "600"}
    )
    assert r.status_code == 201 and r.json()["cycle"] == "2026-09"

    out = (await auth_client.get(f"/api/cards/{card}")).json()
    pending = out["pending_statement"]
    assert (pending["total"], pending["paid"], pending["remaining"]) == (1500.5, 600.0, 900.5)

    st = (await auth_client.get(f"/api/cards/{card}/statement?cycle=2026-09")).json()
    assert st["paid"] == 600.0 and st["remaining"] == 900.5 and st["settled"] is False
    assert [p["amount"] for p in st["payments"]] == [600.0]


async def test_paying_in_full_clears_pending(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _setup(auth_client)
    await auth_client.post(
        f"/api/cards/{card}/payments", json={"date": "2026-10-01", "amount": "1500.50"}
    )
    out = (await auth_client.get(f"/api/cards/{card}")).json()
    assert out["pending_statement"] is None
    st = (await auth_client.get(f"/api/cards/{card}/statement?cycle=2026-09")).json()
    assert st["settled"] is True and st["remaining"] == 0

    # Payments are transfers: spending totals don't move.
    assert (await auth_client.get("/api/expenses")).json()["sum_mxn"] == 1580.5


async def test_explicit_cycle_and_delete(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _setup(auth_client)
    bad = await auth_client.post(
        f"/api/cards/{card}/payments",
        json={"date": "2026-09-30", "amount": "10", "cycle": "2026-13"},
    )
    assert bad.status_code == 422
    p = (
        await auth_client.post(
            f"/api/cards/{card}/payments",
            json={"date": "2026-09-30", "amount": "80", "cycle": "2026-10"},
        )
    ).json()
    current = (await auth_client.get(f"/api/cards/{card}")).json()["current_statement"]
    assert current["remaining"] == 0
    assert (await auth_client.delete(f"/api/cards/{card}/payments/{p['id']}")).status_code == 204
    assert (await auth_client.get(f"/api/cards/{card}/payments")).json() == []


async def test_payments_only_for_credit_cards(auth_client: AsyncClient) -> None:
    cash = (await auth_client.post("/api/cards", json={"name": "E", "kind": "cash"})).json()["id"]
    r = await auth_client.post(
        f"/api/cards/{cash}/payments", json={"date": "2026-09-30", "amount": "10"}
    )
    assert r.status_code == 400


async def test_reconciliation_difference(auth_client: AsyncClient) -> None:
    card = await _setup(auth_client)
    url = f"/api/cards/{card}/statement/2026-09/check"
    assert (await auth_client.put(url, json={"bank_total": "1649.50"})).status_code == 204
    st = (await auth_client.get(f"/api/cards/{card}/statement?cycle=2026-09")).json()
    assert st["bank_total"] == 1649.5
    assert st["difference"] == 149.0  # the bank has $149 you didn't log

    await auth_client.put(url, json={"bank_total": "1500.50"})
    st = (await auth_client.get(f"/api/cards/{card}/statement?cycle=2026-09")).json()
    assert st["difference"] == 0

    assert (await auth_client.delete(url)).status_code == 204
    st = (await auth_client.get(f"/api/cards/{card}/statement?cycle=2026-09")).json()
    assert st["bank_total"] is None and st["difference"] is None


async def test_delete_card_with_payments(auth_client: AsyncClient) -> None:
    card = int((await auth_client.post("/api/cards", json=CREDIT_CARD)).json()["id"])
    await auth_client.post(
        f"/api/cards/{card}/payments",
        json={"date": "2026-09-30", "amount": "10", "cycle": "2026-09"},
    )
    await auth_client.put(f"/api/cards/{card}/statement/2026-09/check", json={"bank_total": "0"})
    assert (await auth_client.delete(f"/api/cards/{card}")).status_code == 204


async def test_remaining_follows_bank_total_once_reconciled(
    auth_client: AsyncClient, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _setup(auth_client)  # Sep statement logged: 1500.50
    await auth_client.put(
        f"/api/cards/{card}/statement/2026-09/check", json={"bank_total": "1460.10"}
    )
    await auth_client.post(
        f"/api/cards/{card}/payments", json={"date": "2026-09-30", "amount": "1000"}
    )
    st = (await auth_client.get(f"/api/cards/{card}/statement?cycle=2026-09")).json()
    assert st["remaining"] == 460.1  # what the bank says you owe, not what you logged
    pending = (await auth_client.get(f"/api/cards/{card}")).json()["pending_statement"]
    assert pending["remaining"] == 460.1

    await auth_client.post(
        f"/api/cards/{card}/payments", json={"date": "2026-10-01", "amount": "460.10"}
    )
    st = (await auth_client.get(f"/api/cards/{card}/statement?cycle=2026-09")).json()
    assert st["settled"] is True and st["remaining"] == 0
    assert (await auth_client.get(f"/api/cards/{card}")).json()["pending_statement"] is None
