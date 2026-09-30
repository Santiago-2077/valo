import datetime as dt

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.recurring import materialize_due
from tests.conftest import CREDIT_CARD


async def _debit(client: AsyncClient) -> int:
    r = await client.post("/api/cards", json={"name": "Nómina", "kind": "debit"})
    return int(r.json()["id"])


async def test_manual_income_crud_and_filters(auth_client: AsyncClient) -> None:
    account = await _debit(auth_client)
    r = await auth_client.post(
        "/api/incomes",
        json={
            "date": "2026-09-12",
            "description": "Logo para cafetería",
            "amount": "3500",
            "kind": "freelance",
            "account_id": account,
        },
    )
    assert r.status_code == 201
    income = r.json()
    await auth_client.post(
        "/api/incomes", json={"date": "2026-10-01", "description": "Venta", "amount": "200"}
    )
    page = (await auth_client.get("/api/incomes?date_from=2026-09-01&date_to=2026-09-30")).json()
    assert page["total"] == 1 and page["sum"] == 3500.0
    assert (await auth_client.get("/api/incomes?kind=other")).json()["total"] == 1

    r = await auth_client.put(
        f"/api/incomes/{income['id']}",
        json={"date": "2026-09-12", "description": "Logo", "amount": "4000", "kind": "freelance"},
    )
    assert r.json()["amount"] == 4000.0
    assert (await auth_client.delete(f"/api/incomes/{income['id']}")).status_code == 204


async def test_income_cannot_land_on_credit_card(auth_client: AsyncClient) -> None:
    credit = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()["id"]
    r = await auth_client.post(
        "/api/incomes",
        json={"date": "2026-09-12", "description": "x", "amount": "1", "account_id": credit},
    )
    assert r.status_code == 422


async def test_quincenal_salary_records_itself(
    auth_client: AsyncClient, session: AsyncSession, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 20))
    account = await _debit(auth_client)
    r = await auth_client.post(
        "/api/recurring-incomes",
        json={
            "name": "Sueldo",
            "amount": "9500",
            "frequency": "semimonthly",
            "day_of_month": 15,
            "second_day": 31,
            "account_id": account,
            "starts_on": "2026-09-01",
        },
    )
    assert r.status_code == 201
    source = r.json()
    assert source["next_run"] == "2026-09-30"
    assert source["monthly_amount"] == 19000.0 and source["yearly_amount"] == 228000.0
    assert source["last_received"] == "2026-09-15"

    await materialize_due(session, dt.date(2026, 10, 31))
    page = (await auth_client.get("/api/incomes")).json()
    assert [i["date"] for i in page["items"]] == [
        "2026-10-31",
        "2026-10-15",
        "2026-09-30",
        "2026-09-15",
    ]
    assert page["sum"] == 38000.0
    assert all(i["kind"] == "salary" and i["account_id"] == account for i in page["items"])


async def test_semimonthly_validation(auth_client: AsyncClient) -> None:
    base = {"name": "Sueldo", "amount": "9500", "frequency": "semimonthly", "day_of_month": 15}
    assert (await auth_client.post("/api/recurring-incomes", json=base)).status_code == 422
    same = {**base, "second_day": 15}
    assert (await auth_client.post("/api/recurring-incomes", json=same)).status_code == 422


async def test_yearly_bonus_and_delete_keeps_history(
    auth_client: AsyncClient, freeze_today
) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 12, 21))
    r = await auth_client.post(
        "/api/recurring-incomes",
        json={
            "name": "Aguinaldo",
            "kind": "bonus",
            "amount": "14000",
            "amount_is_estimate": True,
            "frequency": "yearly",
            "day_of_month": 20,
            "month_of_year": 12,
            "starts_on": "2026-12-01",
        },
    )
    source = r.json()
    assert source["monthly_amount"] == 1166.67
    [income] = (await auth_client.get("/api/incomes")).json()["items"]
    assert income["date"] == "2026-12-20" and "estimado" in income["note"]

    assert (await auth_client.delete(f"/api/recurring-incomes/{source['id']}")).status_code == 204
    [kept] = (await auth_client.get("/api/incomes")).json()["items"]
    assert kept["recurring_income_id"] is None


async def test_recurring_charge_supports_quincenal(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 20))
    card = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()["id"]
    r = await auth_client.post(
        "/api/recurring",
        json={
            "name": "Clases de inglés",
            "kind": "service",
            "amount": "800",
            "card_id": card,
            "frequency": "semimonthly",
            "day_of_month": 1,
            "second_day": 16,
        },
    )
    body = r.json()
    assert body["next_run"] == "2026-10-01"
    assert body["monthly_cost"] == 1600.0
