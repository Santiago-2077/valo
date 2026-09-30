from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.config import get_settings


def today() -> date:
    """Today in the user's timezone (not the server's, which is usually UTC)."""
    return datetime.now(ZoneInfo(get_settings().timezone)).date()
