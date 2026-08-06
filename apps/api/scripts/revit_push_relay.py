"""Relay: tail the Revit spool file and push batches to /ws/revit.

The pushbutton in Revit only appends JSON lines to a local file; this process
does the networking in CPython (stable, reconnecting, testable without Revit).

Usage (from apps/api, venv active, API on :8000)::

    python -m scripts.revit_push_relay
    python -m scripts.revit_push_relay --self-test   # write 1 fake line and exit
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

SPOOL_PATH = Path(
    os.environ.get(
        "REVIT_SPOOL_PATH",
        Path(os.environ.get("LOCALAPPDATA", str(Path.home())))
        / "BIMDashboard"
        / "revit-spool.jsonl",
    )
)
BATCH_SIZE = 50
POLL_INTERVAL = 1.0
RECONNECT_DELAY = 5


def _utc_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _read_new_lines(spool: Path, state: dict) -> list[dict]:
    """Return new parsed element dicts, tracking inode+offset in ``state``."""
    if not spool.exists():
        return []
    stat = spool.stat()
    if stat.st_ino != state.get("inode"):
        state["inode"] = stat.st_ino
        state["offset"] = 0
    if stat.st_size < state.get("offset", 0):
        state["offset"] = 0

    offset = state.get("offset", 0)
    if stat.st_size == offset:
        return []

    elements: list[dict] = []
    with spool.open("r", encoding="utf-8") as fh:
        fh.seek(offset)
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and data.get("element_id"):
                elements.append(data)
        state["offset"] = fh.tell()
    return elements


async def _connect(websockets, url: str, api_key: str):
    ws = await websockets.connect(url)
    await ws.send(json.dumps({"type": "auth", "api_key": api_key}))
    auth = json.loads(await ws.recv())
    if auth.get("type") != "auth_ok":
        await ws.close()
        raise RuntimeError(f"auth rejected: {auth}")
    print("[relay] auth_ok")
    return ws


async def run(spool: Path) -> int:
    import websockets

    from src.api.deps import get_settings

    settings = get_settings()
    api_key = (settings.revit_api_key or "").strip()
    if not api_key:
        print("ERROR: REVIT_API_KEY is empty in .env", file=sys.stderr)
        return 1

    url = "ws://127.0.0.1:8000/ws/revit"
    state: dict = {}
    print(f"[relay] watching {spool}")
    ws = None
    while True:
        try:
            if ws is None:
                ws = await _connect(websockets, url, api_key)

            elements = _read_new_lines(spool, state)
            for i in range(0, len(elements), BATCH_SIZE):
                batch = elements[i : i + BATCH_SIZE]
                await ws.send(
                    json.dumps(
                        {
                            "type": "element_changed",
                            "document_id": "revit_spool",
                            "elements": batch,
                            "timestamp": _utc_iso(),
                        }
                    )
                )
                ack = json.loads(await ws.recv())
                if ack.get("type") != "ack":
                    raise RuntimeError(f"unexpected reply: {ack}")
                print(f"[relay] ack elements_processed={ack.get('elements_processed')}")

            await asyncio.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            raise
        except Exception as exc:
            print(f"[relay] {exc} - reconnect in {RECONNECT_DELAY}s")
            if ws is not None:
                try:
                    await ws.close()
                except Exception:
                    pass
                ws = None
            await asyncio.sleep(RECONNECT_DELAY)


def self_test(spool: Path) -> None:
    spool.parent.mkdir(parents=True, exist_ok=True)
    line = {
        "element_id": f"relay-selftest-{int(time.time())}",
        "category": "Doors",
        "family": "Relay",
        "type_name": "SelfTest",
        "level": "Level 1",
        "parameters": {"fire_rating": "EI60"},
        "volume": None,
        "area": None,
        "length": None,
    }
    with spool.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(line) + "\n")
    print(f"self-test line appended to {spool}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spool", type=Path, default=SPOOL_PATH)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test(args.spool)
        print("now run: python -m scripts.revit_push_relay")
        return

    try:
        raise SystemExit(asyncio.run(run(args.spool)))
    except KeyboardInterrupt:
        print("\n[relay] stopped")


if __name__ == "__main__":
    main()
