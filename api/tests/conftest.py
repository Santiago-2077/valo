import os
from collections.abc import AsyncIterator

os.environ.setdefault("VALO_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("VALO_SECRET_KEY", "test-secret-key-with-enough-length-32b")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db import get_session
from app.main import app
from app.models import Base, User
from app.security import hash_password

TEST_DB_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(TEST_DB_URL, poolclass=StaticPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def _override() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def user(session: AsyncSession) -> User:
    u = User(username="santi", password_hash=hash_password("supersecret"))
    session.add(u)
    await session.commit()
    return u


@pytest.fixture
async def auth_client(client: AsyncClient, user: User) -> AsyncClient:
    r = await client.post("/api/auth/login", json={"username": "santi", "password": "supersecret"})
    assert r.status_code == 200
    return client


@pytest.fixture(autouse=True)
def _reset_throttle() -> None:
    from app.throttle import login_throttle

    login_throttle._failures.clear()
