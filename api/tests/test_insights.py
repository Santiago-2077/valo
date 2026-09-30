import datetime as dt

from httpx import AsyncClient

from tests.conftest import CREDIT_CARD


async def test_month_insights(auth_client: AsyncClient, freeze_today) -> None:  # type: ignore[no-untyped-def]
    freeze_today(dt.date(2026, 9, 30))
    card = (await auth_client.post("/api/cards", json=CREDIT_CARD)).json()["id"]
    food = (
        await auth_client.post("/api/categories", json={"name": "Comida", "monthly_budget": "2000"})
    ).json()["id"]
    fun = (
        await auth_client.post("/api/categories", json={"name": "Salidas", "monthly_budget": "500"})
    ).json()["id"]
    await auth_client.post("/api/categories", json={"name": "Ropa", "monthly_budget": "1000"})

    async def expense(day: str, amount: str, **extra: object) -> None:
        r = await auth_client.post(
            "/api/expenses",
            json={"date": day, "description": "x", "amount": amount, "card_id": card, **extra},
        )
        assert r.status_code == 201

    await expense("2026-08-20", "999")  # previous month
    await expense("2026-09-03", "1500", category_id=food)
    await expense("2026-09-10", "650", category_id=fun, is_impulse=True)
    await expense("2026-09-12", "350")  # uncategorized
    await auth_client.post(
        "/api/installments",
        json={
            "description": "Tele",
            "total": "6000",
            "n_months": 6,
            "purchase_date": "2026-09-05",
            "card_id": card,
        },
    )
    await auth_client.post(
        "/api/recurring",
        json={
            "name": "Netflix",
            "kind": "subscription",
            "amount": "299",
            "card_id": card,
            "day_of_month": 15,
            "starts_on": "2026-09-01",
        },
    )
    await auth_client.post(
        "/api/incomes", json={"date": "2026-09-15", "description": "Sueldo", "amount": "9500"}
    )
    await auth_client.post(
        f"/api/cards/{card}/payments",
        json={"date": "2026-09-09", "amount": "999", "cycle": "2026-08"},
    )

    r = await auth_client.get("/api/insights/month")
    assert r.status_code == 200
    m = r.json()
    assert m["month"] == "2026-09"
    assert m["income"] == 9500.0
    assert m["expenses"] == 1500 + 650 + 350 + 1000 + 299
    assert m["balance"] == 9500 - 3799
    assert m["impulse"] == 650.0
    assert m["installments"] == 1000.0
    assert m["recurring"] == 299.0
    assert m["card_payments"] == 999.0
    assert m["previous_expenses"] == 999.0
    assert m["fixed_monthly_cost"] == 299.0
    assert m["budget_total"] == 3500.0
    assert m["budget_spent"] == 2150.0

    rows = {c["category_id"]: c for c in m["categories"]}
    assert rows[food]["ratio"] == 0.75
    assert rows[fun]["ratio"] == 1.3  # over budget
    assert rows[None]["spent"] == 1649.0 and rows[None]["budget"] is None
    assert [c["spent"] for c in m["categories"]] == sorted(
        (c["spent"] for c in m["categories"]), reverse=True
    )


async def test_other_month_and_validation(auth_client: AsyncClient) -> None:
    m = (await auth_client.get("/api/insights/month?month=2026-02")).json()
    assert m["expenses"] == 0 and m["categories"] == []
    assert (await auth_client.get("/api/insights/month?month=2026-13")).status_code == 422
