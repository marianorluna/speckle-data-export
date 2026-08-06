"""Probe /ws/revit without Revit: auth + element_changed → source=revit_ws.

Usage (from apps/api, venv active, API on :8000)::

    python -m scripts.probe_revit_ws
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))


async def run() -> int:
    import websockets

    from src.api.deps import get_settings
    from src.infrastructure.db.element_repository import ElementRepository
    from src.infrastructure.db.session import get_session_factory

    settings = get_settings()
    api_key = (settings.revit_api_key or "").strip()
    if not api_key:
        print("ERROR: REVIT_API_KEY is empty in .env", file=sys.stderr)
        return 1

    element_id = "probe-revit-ws-{}".format(uuid4().hex[:12])
    url = "ws://127.0.0.1:8000/ws/revit"
    payload = {
        "type": "element_changed",
        "document_id": "probe_revit_ws",
        "elements": [
            {
                "element_id": element_id,
                "category": "Doors",
                "family": "ProbeFamily",
                "type_name": "ProbeType",
                "level": "Level 1",
                "parameters": {"fire_rating": "EI60"},
                "volume": None,
                "area": None,
                "length": None,
            }
        ],
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }

    async with websockets.connect(url) as ws:
        await ws.send(json.dumps({"type": "auth", "api_key": api_key}))
        auth = json.loads(await ws.recv())
        print("auth:", auth)
        if auth.get("type") != "auth_ok":
            print("ERROR: expected auth_ok", file=sys.stderr)
            return 1

        await ws.send(json.dumps(payload))
        ack = json.loads(await ws.recv())
        print("ack:", ack)
        if ack.get("type") != "ack" or ack.get("elements_processed") != 1:
            print("ERROR: expected ack with elements_processed=1", file=sys.stderr)
            return 1

    factory = get_session_factory()
    async with factory() as session:
        repo = ElementRepository(session)
        row = await repo.get_by_element_id(element_id)

    if row is None:
        print("ERROR: element not found in DB", file=sys.stderr)
        return 1
    if row.source != "revit_ws":
        print(
            "ERROR: expected source=revit_ws, got {!r}".format(row.source),
            file=sys.stderr,
        )
        return 1

    print(
        "ok: element_id={} category={} source={}".format(
            row.element_id, row.category, row.source
        )
    )
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(run()))


if __name__ == "__main__":
    main()
