"""FastAPI dependency injection (settings, DB session, current user)."""

from collections.abc import AsyncIterator
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.user import User
from src.infrastructure.auth.jwt import InvalidTokenError, decode_access_token
from src.infrastructure.db.user_repository import UserRepository

_REPO_ROOT = Path(__file__).resolve().parents[4]
_ENV_FILE = _REPO_ROOT / ".env"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


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
    speckle_poll_interval_seconds: int = 30
    revit_api_key: str = ""
    ws_heartbeat_interval: int = 30

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


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: SessionDep,
    settings: SettingsDep,
) -> User:
    """Resolve the JWT bearer token to an active domain ``User``."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token, secret=settings.jwt_secret)
    except InvalidTokenError as exc:
        raise credentials_exception from exc

    email = payload.get("sub")
    if not isinstance(email, str) or not email:
        raise credentials_exception

    repo = UserRepository(session)
    row = await repo.get_by_email(email)
    if row is None or not row.is_active:
        raise credentials_exception

    return User.model_validate(row)


CurrentUser = Annotated[User, Depends(get_current_user)]
