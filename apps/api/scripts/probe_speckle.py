"""Probe Speckle: print N normalized BIM elements (element_id / category).

Usage (from apps/api, venv active)::

    python -m scripts.probe_speckle
    python -m scripts.probe_speckle --limit 20
    python -m scripts.probe_speckle --stream-id YOUR_STREAM --commit-id OPTIONAL
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))


async def run(stream_id: str, commit_id: str | None, limit: int) -> int:
    from src.api.deps import get_settings
    from src.infrastructure.speckle import SpeckleClient

    settings = get_settings()
    token = settings.speckle_token
    server = settings.speckle_server_url
    resolved_stream = stream_id or settings.speckle_stream_id

    if not token:
        print("ERROR: SPECKLE_TOKEN is empty in .env", file=sys.stderr)
        return 1
    if not resolved_stream:
        print("ERROR: pass --stream-id or set SPECKLE_STREAM_ID in .env", file=sys.stderr)
        return 1

    async with SpeckleClient(server, token) as client:
        stream = await client.get_stream(resolved_stream)
        print(f"stream: {stream.get('id')} — {stream.get('name')}")
        resolved_commit, elements = await client.get_bim_elements(
            resolved_stream,
            commit_id=commit_id,
        )
        print(f"commit: {resolved_commit}")
        print(f"elements: {len(elements)} (showing up to {limit})")
        for index, element in enumerate(elements[:limit], start=1):
            print(
                f"{index:4d}. {element['element_id'][:36]:36}  "
                f"{element['category']}"
                + (f"  level={element['level']}" if element.get("level") else "")
            )
        if not elements:
            print(
                "WARN: 0 elements — check that the stream has a Revit Send "
                "with categorized objects.",
                file=sys.stderr,
            )
            return 2
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe Speckle BIM element normalization")
    parser.add_argument("--stream-id", default="", help="Override SPECKLE_STREAM_ID")
    parser.add_argument("--commit-id", default=None, help="Optional commit id")
    parser.add_argument("--limit", type=int, default=30, help="Max rows to print")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(run(args.stream_id, args.commit_id, args.limit)))


if __name__ == "__main__":
    main()
