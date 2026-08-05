"""FastAPI dependency injection placeholders (settings, DB session)."""

from collections.abc import AsyncIterator
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

_REPO_ROOT = Path(__file__).resolve().parents[4]
_ENV_FILE = _REPO_ROOT / ".env"


class Settings(BaseSettings):
    """Runtime configuration loaded from environment / ``.env``."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE if _ENV_FILE.is_file() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite+aiosqlite:///./data/bim.db"
    cors_origins: str = "http://localhost:5173"
    jwt_secret: str = "dev-only-change-me"
    jwt_expires_hours: int = 24
    admin_email: str = "admin@bim.local"
    admin_password_hash: str = ""
    speckle_token: str = ""
    speckle_server_url: str = "https://speckle.xyz"
    speckle_stream_id: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a DB session (delegates to infrastructure after engine init)."""
    from src.infrastructure.db.session import get_db_session

    async for session in get_db_session():
        yield session


SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
