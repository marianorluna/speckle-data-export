"""Validate LLM-generated SQL before execution (allowlist, SELECT-only)."""

from __future__ import annotations

import re

_UNABLE = "UNABLE_TO_ANSWER"

# DML / DDL / SQLite admin — blocked even inside subqueries.
_FORBIDDEN = re.compile(
    r"\b("
    r"INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|"
    r"ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|GRANT|REVOKE|"
    r"EXEC|EXECUTE|INTO|MERGE|CALL"
    r")\b",
    re.IGNORECASE,
)

# Table / view references after FROM or JOIN.
_FROM_JOIN = re.compile(
    r"\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)",
    re.IGNORECASE,
)

_ALLOWED_TABLES = frozenset({"bim_elements"})


def normalize_llm_sql(raw: str) -> str:
    """Strip markdown fences and trailing noise from model output."""
    text = raw.strip()
    if text.upper() == _UNABLE:
        return _UNABLE

    if text.startswith("```"):
        lines = text.splitlines()
        # Drop opening ``` or ```sql
        lines = lines[1:]
        while lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # Single trailing semicolon is allowed by SQLite; strip for checks.
    return text.rstrip().rstrip(";").strip()


def is_safe_sql(sql: str) -> bool:
    """
    Return True only for single-statement read queries over ``bim_elements``.

    Allows ``SELECT`` and ``WITH ... SELECT``. Rejects comments, multi-statements,
    and any forbidden keyword / non-allowlisted table.
    """
    cleaned = normalize_llm_sql(sql)
    if not cleaned or cleaned.upper() == _UNABLE:
        return False

    if ";" in cleaned:
        return False
    if "--" in cleaned or "/*" in cleaned or "*/" in cleaned:
        return False

    upper = cleaned.upper().lstrip()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return False

    if _FORBIDDEN.search(cleaned):
        return False

    tables = {match.group(1).lower() for match in _FROM_JOIN.finditer(cleaned)}
    if not tables:
        return False
    if not tables.issubset(_ALLOWED_TABLES):
        return False

    return True
