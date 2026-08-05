"""SQLAlchemy async engine and session factory (SQLite + aiosqlite)."""

from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.api.deps import get_settings
from src.infrastructure.db.models import Base

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _ensure_sqlite_parent_dir(database_url: str) -> None:
    """Create the parent directory for a file-based SQLite URL if needed."""
    prefix = "sqlite+aiosqlite:///"
    if not database_url.startswith(prefix):
        return
    path_part = database_url.removeprefix(prefix)
    if path_part in {":memory:", ""} or path_part.startswith("file:"):
        return
    db_path = Path(path_part)
    if not db_path.is_absolute():
        db_path = Path.cwd() / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)


def init_engine() -> AsyncEngine:
    """Create (or return) the process-wide async engine."""
    global _engine, _session_factory
    if _engine is not None:
        return _engine

    settings = get_settings()
    _ensure_sqlite_parent_dir(settings.database_url)
    _engine = create_async_engine(
        settings.database_url,
        echo=False,
        connect_args={"check_same_thread": False},
    )
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the session factory; requires ``init_engine`` first."""
    if _session_factory is None:
        init_engine()
    assert _session_factory is not None
    return _session_factory


async def init_db() -> None:
    """Create all tables (dev convenience; prefer Alembic in production)."""
    engine = init_engine()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    """Dispose the engine on application shutdown."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """Yield an ``AsyncSession`` for FastAPI dependency injection."""
    factory = get_session_factory()
    async with factory() as session:
        yield session
