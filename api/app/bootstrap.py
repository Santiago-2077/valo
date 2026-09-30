from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Category, User
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


DEFAULT_CATEGORIES = [
    ("Comida", "fork-knife", "#c2410c"),
    ("Súper", "shopping-cart", "#4d7c0f"),
    ("Transporte", "car", "#0369a1"),
    ("Entretenimiento", "film-strip", "#a21caf"),
    ("Suscripciones", "repeat", "#6d28d9"),
    ("Servicios", "lightning", "#b45309"),
    ("Salud", "heartbeat", "#be123c"),
    ("Ropa", "t-shirt", "#0f766e"),
    ("Hogar", "house", "#57534e"),
    ("Otros", "tag", "#78716c"),
]


async def ensure_default_categories(session: AsyncSession) -> None:
    if await session.scalar(select(func.count()).select_from(Category)):
        return
    session.add_all(Category(name=n, icon=i, color=c) for n, i, c in DEFAULT_CATEGORIES)
    await session.commit()
