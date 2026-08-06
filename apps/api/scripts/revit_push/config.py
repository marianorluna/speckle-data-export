# -*- coding: utf-8 -*-
"""Config for the Revit-side spool writer (IronPython, zero dependencies)."""

import os

SPOOL_PATH = os.path.join(
    os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
    "BIMDashboard",
    "revit-spool.jsonl",
)

DEBOUNCE_SECONDS = 1.0
MAX_SPOOL_BYTES = 5 * 1024 * 1024
