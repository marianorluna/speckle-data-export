"""Background Speckle polling (asyncio task in FastAPI lifespan)."""

from __future__ import annotations

import asyncio
import logging

from src.api.deps import get_settings
from src.application.ingest_commit import IngestCommit
from src.infrastructure.db.element_repository import (
    ElementRepository,
    ProcessedCommitRepository,
    SnapshotRepository,
)
from src.infrastructure.db.session import get_session_factory
from src.infrastructure.speckle import SpeckleApiError, SpeckleClient
from src.infrastructure.ws_hub import broadcast_commit_processed

logger = logging.getLogger(__name__)


async def poll_speckle_loop() -> None:
    """Poll Speckle forever until cancelled; skip quietly when not configured."""
    settings = get_settings()
    interval = max(5, settings.speckle_poll_interval_seconds)
    logger.info("Speckle poller started (interval=%ss)", interval)

    while True:
        try:
            await poll_once()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Speckle poll iteration failed")
        await asyncio.sleep(interval)


async def poll_once() -> None:
    """Fetch latest commit; ingest only when unseen."""
    settings = get_settings()
    stream_id = (settings.speckle_stream_id or "").strip()
    token = settings.speckle_token or ""

    if not stream_id or not token:
        logger.debug("Speckle poll skipped: SPECKLE_STREAM_ID / SPECKLE_TOKEN unset")
        return

    factory = get_session_factory()
    async with SpeckleClient(settings.speckle_server_url, token) as client:
        try:
            commit = await client.get_latest_commit(stream_id)
        except SpeckleApiError:
            logger.exception("Speckle poll: failed to read latest commit")
            return

        commit_id = str(commit["id"])
        async with factory() as session:
            processed_repo = ProcessedCommitRepository(session)
            if await processed_repo.is_processed(commit_id):
                logger.debug("Speckle poll: commit %s already processed", commit_id)
                return

            use_case = IngestCommit(
                client,
                ElementRepository(session),
                SnapshotRepository(session),
                processed_repo,
            )
            result = await use_case.execute(stream_id, commit_id=commit_id)
            await session.commit()

    if result.skipped:
        return

    await broadcast_commit_processed(
        commit_id=result.commit_id,
        stream_id=result.stream_id,
        elements_processed=result.elements_processed,
        source="poller",
    )
    logger.info(
        "Speckle poll ingested commit=%s elements=%s",
        result.commit_id,
        result.elements_processed,
    )
