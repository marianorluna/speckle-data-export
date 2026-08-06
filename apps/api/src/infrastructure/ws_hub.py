"""Public broadcast façade — delegates to the real ConnectionManager."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from src.api.connection_manager import manager
from src.api.schemas import KpiOut
from src.infrastructure.db.element_repository import ElementRepository
from src.infrastructure.db.session import get_session_factory


async def broadcast(event: dict[str, Any]) -> None:
    """Fan-out ``event`` to all dashboard WebSocket clients."""
    await manager.broadcast_to_dashboard(event)


async def broadcast_commit_processed(
    *,
    commit_id: str,
    elements_processed: int,
    stream_id: str | None = None,
    source: str | None = None,
) -> None:
    """Notify dashboards after a Speckle commit is ingested."""
    factory = get_session_factory()
    async with factory() as session:
        kpis_raw = await ElementRepository(session).compute_kpis()
    kpis = KpiOut.model_validate(kpis_raw).model_dump(mode="json")
    event: dict[str, Any] = {
        "type": "commit_processed",
        "commit_id": commit_id,
        "elements_processed": elements_processed,
        "kpis": kpis,
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
    if stream_id is not None:
        event["stream_id"] = stream_id
    if source is not None:
        event["source"] = source
    await manager.broadcast_to_dashboard(event)
