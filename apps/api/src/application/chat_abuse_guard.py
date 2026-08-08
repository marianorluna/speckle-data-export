"""In-memory abuse guard for off-topic chat questions (per user)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import Lock


@dataclass
class AbuseSnapshot:
    """Current abuse state for a user."""

    strikes: int
    blocked_until: datetime | None
    just_blocked: bool = False


@dataclass
class _UserState:
    strikes: int = 0
    blocked_until: datetime | None = None


class ChatAbuseGuard:
    """
    Sliding strike counter: N off-topic refusals → temporary block.

    Successful model queries reset strikes (only when not currently blocked).
    State is process-local (lost on uvicorn restart).
    """

    def __init__(
        self,
        *,
        max_strikes: int = 3,
        block_duration: timedelta = timedelta(hours=1),
    ) -> None:
        if max_strikes < 1:
            raise ValueError("max_strikes must be >= 1")
        self._max_strikes = max_strikes
        self._block_duration = block_duration
        self._states: dict[str, _UserState] = {}
        self._lock = Lock()

    def check(self, user_key: str) -> AbuseSnapshot:
        """Return current state; clears expired blocks."""
        with self._lock:
            state = self._ensure(user_key)
            self._expire_if_needed(state)
            return AbuseSnapshot(
                strikes=state.strikes,
                blocked_until=state.blocked_until,
            )

    def record_refusal(self, user_key: str) -> AbuseSnapshot:
        """Increment strikes; block when threshold is reached."""
        with self._lock:
            state = self._ensure(user_key)
            self._expire_if_needed(state)
            if state.blocked_until is not None:
                return AbuseSnapshot(
                    strikes=state.strikes,
                    blocked_until=state.blocked_until,
                )

            state.strikes += 1
            just_blocked = False
            if state.strikes >= self._max_strikes:
                state.blocked_until = datetime.now(UTC) + self._block_duration
                just_blocked = True
            return AbuseSnapshot(
                strikes=state.strikes,
                blocked_until=state.blocked_until,
                just_blocked=just_blocked,
            )

    def record_success(self, user_key: str) -> None:
        """Reset strikes after a valid model query (no-op if blocked)."""
        with self._lock:
            state = self._ensure(user_key)
            self._expire_if_needed(state)
            if state.blocked_until is None:
                state.strikes = 0

    def _ensure(self, user_key: str) -> _UserState:
        if user_key not in self._states:
            self._states[user_key] = _UserState()
        return self._states[user_key]

    def _expire_if_needed(self, state: _UserState) -> None:
        if state.blocked_until is None:
            return
        if datetime.now(UTC) >= state.blocked_until:
            state.blocked_until = None
            state.strikes = 0


# Process-wide singleton (single-worker local / Coolify default).
chat_abuse_guard = ChatAbuseGuard()
