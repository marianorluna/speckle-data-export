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


def _resolve_env_file() -> Path:
    """Locate ``.env`` in the monorepo root (local) or ``/app`` (Docker image).

    Local layout: ``.../apps/api/src/api/deps.py`` → repo root at ``parents[4]``.
    Docker layout: ``/app/src/api/deps.py`` → only ``parents[2]`` (``/app``) exists;
    secrets then come from the process environment (Compose / Coolify).
    """
    here = Path(__file__).resolve()
    candidates: list[Path] = []
    # Docker WORKDIR /app (alembic.ini sits next to src/).
    if (here.parents[2] / "alembic.ini").is_file():
        candidates.append(here.parents[2] / ".env")
    try:
        candidates.append(here.parents[4] / ".env")
    except IndexError:
        pass
    candidates.append(Path.cwd() / ".env")
    for path in candidates:
        if path.is_file():
            return path
    return candidates[0]


_ENV_FILE = _resolve_env_file()

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
    guest_email: str = ""
    guest_password_hash: str = ""
    guest_extended_email: str = ""
    guest_extended_password_hash: str = ""
    speckle_token: str = ""
    # Read-oriented token exposed to the frontend via viewer-config (falls back to SPECKLE_TOKEN).
    speckle_viewer_token: str = ""
    speckle_server_url: str = "https://speckle.xyz"
    speckle_stream_id: str = ""
    # Speckle "model" name (legacy branch). Folders use ``folder/model`` (e.g. structure/snowdon-towers-r27).
    speckle_branch_name: str = "main"
    speckle_poll_interval_seconds: int = 30
    revit_api_key: str = ""
    ws_heartbeat_interval: int = 30
    openrouter_api_key: str = ""
    openrouter_model: str = "deepseek/deepseek-chat"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    chat_guest_daily_limit: int = 3
    chat_guest_extended_daily_limit: int = 50

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def effective_speckle_viewer_token(self) -> str:
        """Token safe to send to the browser; prefer dedicated viewer PAT."""
        viewer = self.speckle_viewer_token.strip()
        if viewer:
            return viewer
        return self.speckle_token.strip()


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


async def require_admin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """Require an authenticated user with role ``admin``."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
