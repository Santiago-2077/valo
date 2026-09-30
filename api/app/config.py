from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="VALO_", extra="ignore")

    database_url: str = "postgresql+asyncpg://valo:valo@localhost:5432/valo"
    secret_key: str = "change-me"
    access_token_minutes: int = 60 * 24 * 7
    cookie_name: str = "valo_session"
    cookie_secure: bool = False

    # Bootstrap user created on startup when the users table is empty.
    admin_username: str | None = None
    admin_password: str | None = None

    base_currency: str = "MXN"


@lru_cache
def get_settings() -> Settings:
    return Settings()
