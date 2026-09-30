from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bootstrap import ensure_admin
from app.config import get_settings
from app.models import User


async def test_health(client: AsyncClient) -> None:
    r = await client.get("/api/health")
    assert r.json() == {"status": "ok"}


async def test_me_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


async def test_login_wrong_password(client: AsyncClient, user: User) -> None:
    r = await client.post("/api/auth/login", json={"username": "santi", "password": "nope"})
    assert r.status_code == 401
    assert get_settings().cookie_name not in r.cookies


async def test_login_sets_httponly_cookie_and_me_works(client: AsyncClient, user: User) -> None:
    r = await client.post("/api/auth/login", json={"username": "santi", "password": "supersecret"})
    assert r.status_code == 200
    assert "httponly" in r.headers["set-cookie"].lower()
    me = await client.get("/api/auth/me")
    assert me.json()["username"] == "santi"


async def test_logout_clears_session(auth_client: AsyncClient) -> None:
    await auth_client.post("/api/auth/logout")
    assert (await auth_client.get("/api/auth/me")).status_code == 401


async def test_tampered_token_rejected(client: AsyncClient, user: User) -> None:
    client.cookies.set(get_settings().cookie_name, "not-a-jwt")
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_change_password(auth_client: AsyncClient) -> None:
    bad = await auth_client.post(
        "/api/auth/password", json={"current_password": "x", "new_password": "newpassword1"}
    )
    assert bad.status_code == 400
    ok = await auth_client.post(
        "/api/auth/password",
        json={"current_password": "supersecret", "new_password": "newpassword1"},
    )
    assert ok.status_code == 204
    await auth_client.post("/api/auth/logout")
    r = await auth_client.post(
        "/api/auth/login", json={"username": "santi", "password": "newpassword1"}
    )
    assert r.status_code == 200


async def test_ensure_admin_creates_once(session: AsyncSession, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    settings = get_settings()
    monkeypatch.setattr(settings, "admin_username", "admin")
    monkeypatch.setattr(settings, "admin_password", "adminpass")
    await ensure_admin(session)
    await ensure_admin(session)
    users = (await session.scalars(select(User))).all()
    assert [u.username for u in users] == ["admin"]


async def test_login_throttled_after_repeated_failures(client: AsyncClient, user: User) -> None:
    for _ in range(5):
        r = await client.post("/api/auth/login", json={"username": "santi", "password": "bad"})
        assert r.status_code == 401
    r = await client.post("/api/auth/login", json={"username": "santi", "password": "supersecret"})
    assert r.status_code == 429
