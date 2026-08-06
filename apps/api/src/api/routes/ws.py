"""WebSocket routes: dashboard listeners and pyRevit push."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, ValidationError

from src.api.connection_manager import manager
from src.api.deps import get_settings
from src.api.schemas import KpiOut
from src.infrastructure.db.element_repository import ElementRepository
from src.infrastructure.db.session import get_session_factory
from src.infrastructure.speckle.normalize import parameters_to_json

logger = logging.getLogger(__name__)

router = APIRouter()


class RevitElementPayload(BaseModel):
    """One element pushed from pyRevit DocumentChanged."""

    element_id: str
    category: str
    family: str | None = None
    type_name: str | None = None
    level: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    volume: float | None = None
    area: float | None = None
    length: float | None = None


class ElementChangedMessage(BaseModel):
    type: str
    document_id: str | None = None
    elements: list[RevitElementPayload]
    timestamp: str | None = None


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _parse_parameters(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _diff_value(old: object, new: object) -> dict[str, object] | None:
    if old == new:
        return None
    return {"old": old, "new": new}


def _build_changes(
    *,
    old_params: dict[str, Any],
    new_params: dict[str, Any],
    old_volume: float | None,
    new_volume: float | None,
    old_level: str | None,
    new_level: str | None,
) -> dict[str, dict[str, object]]:
    changes: dict[str, dict[str, object]] = {}
    keys = set(old_params) | set(new_params)
    for key in keys:
        delta = _diff_value(old_params.get(key), new_params.get(key))
        if delta is not None:
            changes[key] = delta
    volume_delta = _diff_value(old_volume, new_volume)
    if volume_delta is not None:
        changes["volume"] = volume_delta
    level_delta = _diff_value(old_level, new_level)
    if level_delta is not None:
        changes["level"] = level_delta
    return changes


async def _initial_state_payload() -> dict[str, Any]:
    factory = get_session_factory()
    async with factory() as session:
        repo = ElementRepository(session)
        kpis_raw = await repo.compute_kpis()
    kpis = KpiOut.model_validate(kpis_raw).model_dump(mode="json")
    return {
        "type": "initial_state",
        "kpis": kpis,
        "total_elements": kpis.get("total_elements", 0),
        "last_updated": kpis.get("last_updated"),
    }


@router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket) -> None:
    """Clients receive live KPI / element updates (no auth for MVP)."""
    await websocket.accept()
    client_id = manager.new_client_id()
    await manager.connect(client_id, websocket, "dashboard")
    try:
        await websocket.send_json(await _initial_state_payload())
        while True:
            data = await websocket.receive_json()
            if isinstance(data, dict) and data.get("type") == "pong":
                manager.mark_pong(client_id)
    except WebSocketDisconnect:
        logger.debug("dashboard WS disconnected id=%s", client_id)
    except Exception:
        logger.exception("dashboard WS error id=%s", client_id)
    finally:
        await manager.disconnect(client_id, "dashboard")


@router.websocket("/ws/revit")
async def revit_ws(websocket: WebSocket) -> None:
    """pyRevit push channel; first message must be auth with REVIT_API_KEY."""
    await websocket.accept()
    settings = get_settings()
    expected_key = (settings.revit_api_key or "").strip()
    client_id = manager.new_client_id()
    authenticated = False

    try:
        auth_msg = await websocket.receive_json()
        if not isinstance(auth_msg, dict) or auth_msg.get("type") != "auth":
            await websocket.send_json(
                {"type": "error", "message": "expected auth handshake"}
            )
            await websocket.close(code=4001)
            return
        provided = str(auth_msg.get("api_key") or "")
        if not expected_key or provided != expected_key:
            await websocket.send_json(
                {"type": "error", "message": "invalid api_key"}
            )
            await websocket.close(code=4003)
            return

        authenticated = True
        await manager.connect(client_id, websocket, "revit")
        await websocket.send_json(
            {"type": "auth_ok", "timestamp": _utc_now_iso()}
        )

        while True:
            raw = await websocket.receive_json()
            if not isinstance(raw, dict):
                await websocket.send_json(
                    {"type": "error", "message": "message must be a JSON object"}
                )
                continue

            msg_type = raw.get("type")
            if msg_type == "pong":
                manager.mark_pong(client_id)
                continue

            if msg_type != "element_changed":
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": f"unsupported type: {msg_type!r}",
                    }
                )
                continue

            try:
                message = ElementChangedMessage.model_validate(raw)
            except ValidationError as exc:
                await websocket.send_json(
                    {"type": "error", "message": str(exc)}
                )
                continue

            processed = await _apply_revit_changes(message)
            await websocket.send_json(
                {
                    "type": "ack",
                    "elements_processed": processed,
                    "timestamp": _utc_now_iso(),
                }
            )
    except WebSocketDisconnect:
        logger.debug("revit WS disconnected id=%s", client_id)
    except Exception:
        logger.exception("revit WS error id=%s", client_id)
    finally:
        if authenticated:
            await manager.disconnect(client_id, "revit")


async def _apply_revit_changes(message: ElementChangedMessage) -> int:
    """Upsert elements from pyRevit and broadcast per-element diffs after commit."""
    factory = get_session_factory()
    events: list[dict[str, Any]] = []
    async with factory() as session:
        repo = ElementRepository(session)
        for element in message.elements:
            existing = await repo.get_by_element_id(element.element_id)
            old_params = _parse_parameters(
                existing.parameters if existing is not None else None
            )
            old_volume = existing.volume if existing is not None else None
            old_level = existing.level if existing is not None else None

            values: dict[str, object] = {
                "category": element.category,
                "family": element.family,
                "type_name": element.type_name,
                "level": element.level,
                "parameters": parameters_to_json(element.parameters),
                "volume": element.volume,
                "area": element.area,
                "length": element.length,
                "source": "revit_ws",
            }
            await repo.upsert_element(
                element_id=element.element_id,
                values=values,
            )

            changes = _build_changes(
                old_params=old_params,
                new_params=element.parameters,
                old_volume=old_volume,
                new_volume=element.volume,
                old_level=old_level,
                new_level=element.level,
            )
            events.append(
                {
                    "type": "element_updated",
                    "element_id": element.element_id,
                    "category": element.category,
                    "level": element.level,
                    "changes": changes,
                    "document_id": message.document_id,
                    "timestamp": message.timestamp or _utc_now_iso(),
                }
            )
        await session.commit()

    for event in events:
        await manager.broadcast_to_dashboard(event)
    return len(events)
