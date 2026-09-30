from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import User
from app.security import hash_password


async def ensure_admin(session: AsyncSession) -> None:
    """Create the single app user from env vars if no user exists yet."""
    settings = get_settings()
    if not (settings.admin_username and settings.admin_password):
        return
    if await session.scalar(select(func.count()).select_from(User)):
        return
    session.add(
        User(username=settings.admin_username, password_hash=hash_password(settings.admin_password))
    )
    await session.commit()
