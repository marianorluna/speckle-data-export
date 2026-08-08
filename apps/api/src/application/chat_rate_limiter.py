"""In-memory daily chat quota for guest users (keyed by client IP)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from threading import Lock


@dataclass(frozen=True)
class RateLimitSnapshot:
    """Current daily quota state for an IP."""

    count: int
    limit: int
    remaining: int
    blocked: bool
    """True when the daily quota is exhausted."""

    blocked_until: datetime | None
    """UTC midnight of the next calendar day when blocked; else None."""


class ChatRateLimiter:
    """
    Fixed-window daily counter per IP (UTC calendar day).

    State is process-local (lost on uvicorn restart / redeploy).
    """

    def __init__(self, *, daily_limit: int = 3) -> None:
        if daily_limit < 1:
            raise ValueError("daily_limit must be >= 1")
        self._daily_limit = daily_limit
        self._counts: dict[str, int] = {}
        self._lock = Lock()

    @property
    def daily_limit(self) -> int:
        return self._daily_limit

    def set_daily_limit(self, daily_limit: int) -> None:
        if daily_limit < 1:
            raise ValueError("daily_limit must be >= 1")
        with self._lock:
            self._daily_limit = daily_limit

    def check(self, ip: str, *, now: datetime | None = None) -> RateLimitSnapshot:
        """Return current quota without incrementing."""
        with self._lock:
            return self._snapshot(ip, now=now)

    def record(self, ip: str, *, now: datetime | None = None) -> RateLimitSnapshot:
        """
        Consume one quota slot for ``ip`` on the current UTC day.

        Call only when the request will hit the LLM (after pre-checks pass).
        """
        with self._lock:
            key = self._key(ip, now=now)
            self._counts[key] = self._counts.get(key, 0) + 1
            return self._snapshot(ip, now=now)

    def _snapshot(self, ip: str, *, now: datetime | None) -> RateLimitSnapshot:
        key = self._key(ip, now=now)
        count = self._counts.get(key, 0)
        limit = self._daily_limit
        blocked = count >= limit
        remaining = max(0, limit - count)
        blocked_until = self._next_utc_midnight(now) if blocked else None
        return RateLimitSnapshot(
            count=count,
            limit=limit,
            remaining=remaining,
            blocked=blocked,
            blocked_until=blocked_until,
        )

    def _key(self, ip: str, *, now: datetime | None) -> str:
        day = self._utc_day(now)
        return f"ip:{ip}|day:{day.isoformat()}"

    @staticmethod
    def _utc_day(now: datetime | None) -> date:
        instant = now if now is not None else datetime.now(UTC)
        if instant.tzinfo is None:
            instant = instant.replace(tzinfo=UTC)
        return instant.astimezone(UTC).date()

    @staticmethod
    def _next_utc_midnight(now: datetime | None) -> datetime:
        day = ChatRateLimiter._utc_day(now)
        return datetime.combine(day + timedelta(days=1), time.min, tzinfo=UTC)


# Process-wide singleton; limit may be synced from settings per request.
chat_rate_limiter = ChatRateLimiter(daily_limit=3)
