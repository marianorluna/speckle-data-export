"""FastAPI entry point — health check, auth, admin ingest, Speckle poller."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
import asyncio
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.deps import get_settings
from src.api.routes import admin, auth
from src.infrastructure.db.session import dispose_engine, init_engine
from src.infrastructure.scheduler import poll_speckle_loop

_API_ROOT = Path(__file__).resolve().parents[2]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Initialize DB, seed admin, start Speckle poller; cancel on shutdown."""
    init_engine()
    try:
        from scripts.seed_admin import seed_admin

        await seed_admin()
    except RuntimeError as exc:
        print(f"Admin seed skipped: {exc}")

    poll_task = asyncio.create_task(poll_speckle_loop(), name="speckle-poller")
    try:
        yield
    finally:
        poll_task.cancel()
        try:
            await poll_task
        except asyncio.CancelledError:
            logger.info("Speckle poller stopped")
        await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="BIM Dashboard API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
