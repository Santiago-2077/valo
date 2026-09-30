import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.clock import today
from app.config import get_settings
from app.db import SessionLocal
from app.services.recurring import materialize_due

log = logging.getLogger(__name__)


async def run_daily_jobs() -> None:
    try:
        async with SessionLocal() as session:
            await materialize_due(session, today())
    except Exception:  # keep the scheduler alive; the next run retries
        log.exception("Daily jobs failed")


def create_scheduler() -> AsyncIOScheduler:
    tz = ZoneInfo(get_settings().timezone)
    scheduler = AsyncIOScheduler(timezone=tz)
    scheduler.add_job(
        run_daily_jobs,
        CronTrigger(hour=0, minute=10, timezone=tz),
        id="daily",
        coalesce=True,
        misfire_grace_time=6 * 3600,
    )
    return scheduler
