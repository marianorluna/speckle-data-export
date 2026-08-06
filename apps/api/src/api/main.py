"""FastAPI entry point — health, auth, admin ingest, REST, WebSockets, Speckle poller."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
import asyncio
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.connection_manager import manager
from src.api.deps import get_settings
from src.api.routes import admin, auth, elements, kpis, qc, ws
from src.infrastructure.db.session import dispose_engine, init_engine
from src.infrastructure.scheduler import poll_speckle_loop

_API_ROOT = Path(__file__).resolve().parents[2]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

logger = logging.getLogger(__name__)


async def _ws_heartbeat_loop() -> None:
    """Ping all sockets; drop clients silent for 2 heartbeat intervals."""
    while True:
        settings = get_settings()
        interval = max(5, settings.ws_heartbeat_interval)
        await asyncio.sleep(interval)
        try:
            await manager.send_pings()
            await manager.drop_stale(max_silence_seconds=interval * 2)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("WebSocket heartbeat iteration failed")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Initialize DB, seed admin, start Speckle poller + WS heartbeat."""
    init_engine()
    try:
        from scripts.seed_admin import seed_admin

        await seed_admin()
    except RuntimeError as exc:
        print(f"Admin seed skipped: {exc}")

    poll_task = asyncio.create_task(poll_speckle_loop(), name="speckle-poller")
    heartbeat_task = asyncio.create_task(
        _ws_heartbeat_loop(),
        name="ws-heartbeat",
    )
    try:
        yield
    finally:
        for task, label in (
            (poll_task, "Speckle poller"),
            (heartbeat_task, "WS heartbeat"),
        ):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                logger.info("%s stopped", label)
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
    app.include_router(elements.router, prefix="/api/elements", tags=["elements"])
    app.include_router(kpis.router, prefix="/api/kpis", tags=["kpis"])
    app.include_router(qc.router, prefix="/api/qc", tags=["qc"])
    app.include_router(ws.router, tags=["websockets"])

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
