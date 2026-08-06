"""No-op WebSocket hub — replaced by real broadcast in prompt 06."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def broadcast(event: dict[str, Any]) -> None:
    """Stub: log the event until the WebSocket hub exists."""
    logger.info("WS stub broadcast: %s", event.get("type", event))
