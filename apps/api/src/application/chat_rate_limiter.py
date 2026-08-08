"""In-memory daily chat quota for guest users (keyed by IP or user id)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from threading import Lock


@dataclass(frozen=True)
class RateLimitSnapshot:
    """Current daily quota state for a quota key."""

    count: int
    limit: int
    remaining: int
    blocked: bool
    """True when the daily quota is exhausted."""

    blocked_until: datetime | None
    """UTC midnight of the next calendar day when blocked; else None."""


class ChatRateLimiter:
    """
    Fixed-window daily counter per opaque key (UTC calendar day).

    Callers pass keys such as ``ip:1.2.3.4`` (public guest) or ``user:42``
    (guest_extended). State is process-local (lost on uvicorn restart / redeploy).
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

    def check(
        self,
        key: str,
        *,
        limit: int | None = None,
        now: datetime | None = None,
    ) -> RateLimitSnapshot:
        """Return current quota without incrementing."""
        with self._lock:
            return self._snapshot(key, limit=limit, now=now)

    def record(
        self,
        key: str,
        *,
        limit: int | None = None,
        now: datetime | None = None,
    ) -> RateLimitSnapshot:
        """
        Consume one quota slot for ``key`` on the current UTC day.

        Call only after a billable success (e.g. query with element_ids).
        """
        with self._lock:
            day_key = self._day_key(key, now=now)
            self._counts[day_key] = self._counts.get(day_key, 0) + 1
            return self._snapshot(key, limit=limit, now=now)

    def _snapshot(
        self,
        key: str,
        *,
        limit: int | None,
        now: datetime | None,
    ) -> RateLimitSnapshot:
        day_key = self._day_key(key, now=now)
        count = self._counts.get(day_key, 0)
        resolved = limit if limit is not None else self._daily_limit
        if resolved < 1:
            raise ValueError("limit must be >= 1")
        blocked = count >= resolved
        remaining = max(0, resolved - count)
        blocked_until = self._next_utc_midnight(now) if blocked else None
        return RateLimitSnapshot(
            count=count,
            limit=resolved,
            remaining=remaining,
            blocked=blocked,
            blocked_until=blocked_until,
        )

    def _day_key(self, key: str, *, now: datetime | None) -> str:
        day = self._utc_day(now)
        return f"{key}|day:{day.isoformat()}"

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


# Process-wide singleton; per-request limit is passed to check/record.
chat_rate_limiter = ChatRateLimiter(daily_limit=3)
