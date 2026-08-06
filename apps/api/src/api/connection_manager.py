"""In-process WebSocket hub for dashboard clients and pyRevit push."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Literal
from uuid import uuid4

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

ClientKind = Literal["dashboard", "revit"]


class ConnectionManager:
    """Tracks active WebSocket connections and fans out JSON events."""

    def __init__(self) -> None:
        self._dashboard: dict[str, WebSocket] = {}
        self._revit: dict[str, WebSocket] = {}
        self._last_pong: dict[str, float] = {}
        self._lock = asyncio.Lock()

    def new_client_id(self) -> str:
        return str(uuid4())

    async def connect(
        self,
        client_id: str,
        websocket: WebSocket,
        kind: ClientKind,
    ) -> None:
        """Register an already-accepted WebSocket under ``kind``."""
        async with self._lock:
            bucket = self._dashboard if kind == "dashboard" else self._revit
            bucket[client_id] = websocket
            self._last_pong[client_id] = time.monotonic()
        logger.info("WS connect kind=%s id=%s", kind, client_id)

    async def disconnect(self, client_id: str, kind: ClientKind) -> None:
        async with self._lock:
            bucket = self._dashboard if kind == "dashboard" else self._revit
            bucket.pop(client_id, None)
            self._last_pong.pop(client_id, None)
        logger.info("WS disconnect kind=%s id=%s", kind, client_id)

    def mark_pong(self, client_id: str) -> None:
        self._last_pong[client_id] = time.monotonic()

    async def broadcast_to_dashboard(self, message: dict[str, Any]) -> None:
        """Send ``message`` to every dashboard client; drop dead sockets."""
        async with self._lock:
            targets = list(self._dashboard.items())

        dead: list[str] = []
        for client_id, websocket in targets:
            try:
                if websocket.client_state != WebSocketState.CONNECTED:
                    dead.append(client_id)
                    continue
                await websocket.send_json(message)
            except Exception:
                logger.exception("WS broadcast failed id=%s", client_id)
                dead.append(client_id)

        for client_id in dead:
            await self.disconnect(client_id, "dashboard")

    async def send_to_revit(self, message: dict[str, Any]) -> None:
        """Send ``message`` to every connected pyRevit client."""
        async with self._lock:
            targets = list(self._revit.items())

        dead: list[str] = []
        for client_id, websocket in targets:
            try:
                if websocket.client_state != WebSocketState.CONNECTED:
                    dead.append(client_id)
                    continue
                await websocket.send_json(message)
            except Exception:
                logger.exception("WS send_to_revit failed id=%s", client_id)
                dead.append(client_id)

        for client_id in dead:
            await self.disconnect(client_id, "revit")

    async def drop_stale(self, *, max_silence_seconds: float) -> None:
        """Disconnect clients that have not ponged within ``max_silence_seconds``."""
        cutoff = time.monotonic() - max_silence_seconds
        async with self._lock:
            stale: list[tuple[str, ClientKind]] = []
            for client_id, last in self._last_pong.items():
                if last >= cutoff:
                    continue
                if client_id in self._dashboard:
                    stale.append((client_id, "dashboard"))
                elif client_id in self._revit:
                    stale.append((client_id, "revit"))

        for client_id, kind in stale:
            bucket = self._dashboard if kind == "dashboard" else self._revit
            websocket = bucket.get(client_id)
            logger.warning("WS stale disconnect kind=%s id=%s", kind, client_id)
            if websocket is not None:
                try:
                    await websocket.close(code=4000)
                except Exception:
                    logger.debug(
                        "WS close on stale failed id=%s",
                        client_id,
                        exc_info=True,
                    )
            await self.disconnect(client_id, kind)

    async def send_pings(self) -> None:
        """Emit ping to all connections and update bookkeeping."""
        now_iso = _utc_now_iso()
        payload = {"type": "ping", "timestamp": now_iso}
        async with self._lock:
            targets: list[tuple[ClientKind, str, WebSocket]] = [
                * (("dashboard", cid, ws) for cid, ws in self._dashboard.items()),
                * (("revit", cid, ws) for cid, ws in self._revit.items()),
            ]

        for kind, client_id, websocket in targets:
            try:
                if websocket.client_state != WebSocketState.CONNECTED:
                    await self.disconnect(client_id, kind)
                    continue
                await websocket.send_json(payload)
            except Exception:
                logger.exception("WS ping failed kind=%s id=%s", kind, client_id)
                await self.disconnect(client_id, kind)

    @property
    def dashboard_count(self) -> int:
        return len(self._dashboard)

    @property
    def revit_count(self) -> int:
        return len(self._revit)


def _utc_now_iso() -> str:
    from datetime import UTC, datetime

    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


manager = ConnectionManager()
