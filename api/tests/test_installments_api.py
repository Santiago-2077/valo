import datetime as dt

from httpx import AsyncClient

from tests.conftest import CREDIT_CARD


async def _card(client: AsyncClient, **overrides: object) -> int:
    return int((await client.post("/api/cards", json={**CREDIT_CARD, **overrides})).json()["id"])


def _plan(card_id: int, **overrides: object) -> dict[str, object]:
    return {
        "description": "iPhone",
        "total": "18000",
        "n_months": 12,
        "purchase_date": "2026-09-15",
        "card_id": card_id,
        **overrides,
    }


async def test_create_plan_generates_charges(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    r = await auth_client.post("/api/installments", json=_plan(card, total="1000", n_months=3))
    assert r.status_code == 201
    plan = r.json()
    assert plan["monthly_amount"] == 333.33
    assert [c["amount"] for c in plan["charges"]] == [333.33, 333.33, 333.34]
    assert [c["cycle"] for c in plan["charges"]] == ["2026-09", "2026-10", "2026-11"]
    assert plan["paid_count"] == 0
    assert plan["next_charge"]["due_date"] == "2026-10-10"
    assert plan["remaining_amount"] == 1000.0

    expenses = (await auth_client.get("/api/expenses")).json()
    assert expenses["total"] == 3 and expenses["sum_mxn"] == 1000.0
    assert {e["installment"]["of"] for e in expenses["items"]} == {3}


async def test_charges_show_up_in_future_statements(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = await _card(auth_client)
    await auth_client.post("/api/installments", json=_plan(card))
    nov = (await auth_client.get(f"/api/cards/{card}/statement?cycle=2026-11")).json()
    assert nov["total"] == 1500.0
    assert nov["expenses"][0]["installment"]["number"] == 3
    out = (await auth_client.get(f"/api/cards/{card}")).json()
    assert out["pending_statement"]["total"] == 1500.0  # Sep charge, due Oct 10
    assert out["current_statement"]["total"] == 1500.0


async def test_paid_progress_and_finished_plans(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    card = await _card(auth_client)
    plan = (
        await auth_client.post(
            "/api/installments", json=_plan(card, n_months=3, purchase_date="2026-01-10")
        )
    ).json()
    freeze_today(dt.date(2026, 3, 11))  # Jan and Feb dues (Feb 10, Mar 10) passed
    got = (await auth_client.get(f"/api/installments/{plan['id']}")).json()
    assert got["paid_count"] == 2 and got["remaining_amount"] == 6000.0

    freeze_today(dt.date(2026, 4, 11))
    assert (await auth_client.get("/api/installments")).json() == []
    finished = (await auth_client.get("/api/installments?include_finished=true")).json()
    assert finished[0]["paid_count"] == 3 and finished[0]["next_charge"] is None


async def test_requires_active_credit_card(auth_client: AsyncClient) -> None:
    cash = await _card(auth_client, kind="cash")
    r = await auth_client.post("/api/installments", json=_plan(cash))
    assert r.status_code == 422
    card = await _card(auth_client)
    for bad in [{"n_months": 1}, {"n_months": 49}, {"total": "0"}, {"category_id": 999}]:
        r = await auth_client.post("/api/installments", json=_plan(card, **bad))
        assert r.status_code == 422, bad


async def test_update_regenerates_charges(auth_client: AsyncClient) -> None:
    card = await _card(auth_client)
    plan = (await auth_client.post("/api/installments", json=_plan(card))).json()
    r = await auth_client.put(
        f"/api/installments/{plan['id']}",
        json=_plan(card, total="600", n_months=6, description="iPhone 17"),
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["charges"]) == 6 and body["monthly_amount"] == 100.0
    expenses = (await auth_client.get("/api/expenses")).json()
    assert expenses["total"] == 6 and expenses["sum_mxn"] == 600.0
    assert {e["description"] for e in expenses["items"]} == {"iPhone 17"}


async def test_charges_cannot_be_edited_individually(auth_client: AsyncClient) -> None:
    card = await _card(auth_client)
    plan = (await auth_client.post("/api/installments", json=_plan(card))).json()
    expense_id = plan["charges"][0]["expense_id"]
    r = await auth_client.put(
        f"/api/expenses/{expense_id}",
        json={"date": "2026-09-15", "description": "x", "amount": "1", "card_id": card},
    )
    assert r.status_code == 409
    assert (await auth_client.delete(f"/api/expenses/{expense_id}")).status_code == 409


async def test_delete_plan_removes_charges(auth_client: AsyncClient) -> None:
    card = await _card(auth_client)
    plan = (await auth_client.post("/api/installments", json=_plan(card))).json()
    assert (await auth_client.delete(f"/api/installments/{plan['id']}")).status_code == 204
    assert (await auth_client.get("/api/expenses")).json()["total"] == 0
    assert (await auth_client.delete(f"/api/cards/{card}")).status_code == 204


async def test_commitments_by_due_month(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    oro = await _card(auth_client)  # closes 20, due 10
    nu = await _card(auth_client, name="Nu", closing_day=3, due_day=23)
    await auth_client.post("/api/installments", json=_plan(oro, total="3000", n_months=3))
    await auth_client.post(
        "/api/installments",
        json=_plan(nu, total="1200", n_months=6, purchase_date="2026-09-20"),
    )
    rows = (await auth_client.get("/api/installments/commitments?months=4")).json()
    assert [r["month"] for r in rows] == ["2026-09", "2026-10", "2026-11", "2026-12"]
    by_month = {r["month"]: (r["total"], r["plans"]) for r in rows}
    # Oro: Sep cycle due Oct 10, Oct due Nov 10, Nov due Dec 10.
    # Nu: bought Sep 20 -> Oct 3 cycle due Oct 23, then Nov 23, Dec 23...
    assert by_month["2026-09"] == (0, 0)
    assert by_month["2026-10"] == (1200.0, 2)
    assert by_month["2026-11"] == (1200.0, 2)
    assert by_month["2026-12"] == (1200.0, 2)
