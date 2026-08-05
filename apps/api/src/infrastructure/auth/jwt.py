"""JWT encoding/decoding and bcrypt password helpers (no FastAPI coupling)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Return a bcrypt hash for ``password``."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode(
        "utf-8"
    )


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if ``plain`` matches the bcrypt ``hashed`` value."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(
    email: str,
    *,
    secret: str,
    expires_hours: int = 24,
) -> str:
    """Encode a JWT with ``sub=email`` and an ``exp`` claim."""
    expire = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_access_token(token: str, *, secret: str) -> dict[str, object]:
    """Decode and validate a JWT. Raises ``InvalidTokenError`` if invalid/expired."""
    return jwt.decode(token, secret, algorithms=[ALGORITHM])


__all__ = [
    "ALGORITHM",
    "InvalidTokenError",
    "create_access_token",
    "decode_access_token",
    "hash_password",
    "verify_password",
]
