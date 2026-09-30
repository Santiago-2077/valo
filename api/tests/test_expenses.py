from httpx import AsyncClient

from tests.conftest import CREDIT_CARD


async def _card(client: AsyncClient, **overrides: object) -> int:
    r = await client.post("/api/cards", json={**CREDIT_CARD, **overrides})
    return int(r.json()["id"])


async def _category(client: AsyncClient, name: str = "Comida") -> int:
    r = await client.post("/api/categories", json={"name": name})
    return int(r.json()["id"])


def _expense(card_id: int, **overrides: object) -> dict[str, object]:
    return {
        "date": "2026-09-21",
        "description": "Tacos",
        "amount": "185.50",
        "card_id": card_id,
        **overrides,
    }


async def test_create_returns_statement_it_falls_in(auth_client: AsyncClient) -> None:
    card = await _card(auth_client)
    r = await auth_client.post("/api/expenses", json=_expense(card))
    assert r.status_code == 201
    body = r.json()
    assert body["amount"] == 185.5 and body["amount_mxn"] == 185.5
    assert body["statement"]["closing_date"] == "2026-10-20"
    assert body["statement"]["due_date"] == "2026-11-10"


async def test_cash_expense_has_no_statement(auth_client: AsyncClient) -> None:
    cash = await _card(auth_client, kind="cash")
    body = (await auth_client.post("/api/expenses", json=_expense(cash))).json()
    assert body["statement"] is None


async def test_validation(auth_client: AsyncClient) -> None:
    card = await _card(auth_client)
    for bad in [
        {"amount": "0"},
        {"amount": "-5"},
        {"amount": "1.234"},
        {"description": ""},
        {"currency": "USD"},
    ]:
        r = await auth_client.post("/api/expenses", json=_expense(card, **bad))
        assert r.status_code == 422, bad
    assert (await auth_client.post("/api/expenses", json=_expense(9999))).status_code == 422
    assert (
        await auth_client.post("/api/expenses", json=_expense(card, category_id=9999))
    ).status_code == 422


async def test_inactive_card_rejected_for_new_but_editable(auth_client: AsyncClient) -> None:
    card = await _card(auth_client)
    expense = (await auth_client.post("/api/expenses", json=_expense(card))).json()
    await auth_client.put(f"/api/cards/{card}", json={**CREDIT_CARD, "active": False})
    assert (await auth_client.post("/api/expenses", json=_expense(card))).status_code == 422
    r = await auth_client.put(
        f"/api/expenses/{expense['id']}", json=_expense(card, description="Tacos al pastor")
    )
    assert r.status_code == 200 and r.json()["description"] == "Tacos al pastor"


async def test_list_filters_and_sum(auth_client: AsyncClient) -> None:
    bbva = await _card(auth_client)
    nu = await _card(auth_client, name="Nu")
    food = await _category(auth_client)
    rows = [
        _expense(bbva, date="2026-09-01", amount="100", category_id=food),
        _expense(bbva, date="2026-09-10", amount="50", is_impulse=True, description="Audífonos"),
        _expense(nu, date="2026-09-15", amount="25.25", category_id=food),
        _expense(nu, date="2026-10-01", amount="10"),
    ]
    for row in rows:
        await auth_client.post("/api/expenses", json=row)

    async def page(qs: str) -> dict:  # type: ignore[type-arg]
        return (await auth_client.get(f"/api/expenses?{qs}")).json()  # type: ignore[no-any-return]

    all_ = await page("")
    assert all_["total"] == 4 and all_["sum_mxn"] == 185.25
    assert [e["date"] for e in all_["items"]] == [
        "2026-10-01",
        "2026-09-15",
        "2026-09-10",
        "2026-09-01",
    ]
    assert (await page("date_from=2026-09-05&date_to=2026-09-30"))["total"] == 2
    assert (await page(f"card_id={nu}"))["sum_mxn"] == 35.25
    assert (await page(f"category_id={food}"))["total"] == 2
    assert (await page("uncategorized=true"))["total"] == 2
    assert (await page("is_impulse=true"))["items"][0]["description"] == "Audífonos"
    assert (await page("q=audí"))["total"] == 1
    paged = await page("limit=1&offset=1")
    assert len(paged["items"]) == 1 and paged["total"] == 4


async def test_update_moves_between_statements(auth_client: AsyncClient) -> None:
    card = await _card(auth_client)
    e = (await auth_client.post("/api/expenses", json=_expense(card, date="2026-09-19"))).json()
    assert e["statement"]["cycle"] == "2026-09"
    moved = await auth_client.put(f"/api/expenses/{e['id']}", json=_expense(card))
    assert moved.json()["statement"]["cycle"] == "2026-10"


async def test_delete_expense(auth_client: AsyncClient) -> None:
    card = await _card(auth_client)
    e = (await auth_client.post("/api/expenses", json=_expense(card))).json()
    assert (await auth_client.delete(f"/api/expenses/{e['id']}")).status_code == 204
    assert (await auth_client.get(f"/api/expenses/{e['id']}")).status_code == 404


async def test_categories_crud_and_delete_uncategorizes(auth_client: AsyncClient) -> None:
    food = await _category(auth_client)
    dup = await auth_client.post("/api/categories", json={"name": "Comida"})
    assert dup.status_code == 409
    r = await auth_client.put(
        f"/api/categories/{food}",
        json={"name": "Comida", "icon": "fork-knife", "monthly_budget": "3000"},
    )
    assert r.json()["monthly_budget"] == 3000.0

    card = await _card(auth_client)
    e = (await auth_client.post("/api/expenses", json=_expense(card, category_id=food))).json()
    assert (await auth_client.delete(f"/api/categories/{food}")).status_code == 204
    assert (await auth_client.get(f"/api/expenses/{e['id']}")).json()["category_id"] is None
