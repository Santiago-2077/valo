from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI

from app.bootstrap import ensure_admin, ensure_default_categories
from app.config import get_settings
from app.db import SessionLocal
from app.routers import (
    auth,
    cards,
    categories,
    expenses,
    incomes,
    insights,
    installments,
    recurring,
)
from app.scheduler import create_scheduler, run_daily_jobs


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if len(get_settings().secret_key) < 32:
        raise RuntimeError("VALO_SECRET_KEY must be set to a random string of 32+ chars")
    async with SessionLocal() as session:
        await ensure_admin(session)
        await ensure_default_categories(session)
    scheduler = None
    if get_settings().scheduler_enabled:
        await run_daily_jobs()  # catch up anything missed while the server was down
        scheduler = create_scheduler()
        scheduler.start()
    yield
    if scheduler is not None:
        scheduler.shutdown(wait=False)


api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(cards.router)
api.include_router(categories.router)
api.include_router(expenses.router)
api.include_router(installments.router)
api.include_router(recurring.router)
api.include_router(incomes.router)
api.include_router(insights.router)


@api.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


app = FastAPI(
    title="Valo API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.include_router(api)
