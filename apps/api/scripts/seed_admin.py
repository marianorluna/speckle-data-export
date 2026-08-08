"""Seed admin + guest users from env (upsert by email).

Usage (from apps/api with venv active)::

    python -m scripts.seed_admin
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow ``python -m scripts.seed_admin`` from apps/api
_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))


async def seed_users() -> dict[str, str]:
    """Upsert admin (required) and guest (optional) from settings.

    Returns a map of email → ``created`` | ``updated`` for rows touched.
    """
    from src.api.deps import get_settings
    from src.infrastructure.db.session import get_session_factory, init_engine
    from src.infrastructure.db.user_repository import UserRepository

    settings = get_settings()
    if not settings.admin_email:
        raise RuntimeError("ADMIN_EMAIL is required in .env")
    if not settings.admin_password_hash:
        raise RuntimeError("ADMIN_PASSWORD_HASH is required in .env")

    init_engine()
    factory = get_session_factory()
    results: dict[str, str] = {}

    async with factory() as session:
        repo = UserRepository(session)

        admin_action = await repo.upsert_by_email(
            email=settings.admin_email,
            password_hash=settings.admin_password_hash,
            role="admin",
            is_active=True,
        )
        results[settings.admin_email] = admin_action
        print(f"Admin user {admin_action}: {settings.admin_email}")

        guest_email = (settings.guest_email or "").strip()
        guest_hash = (settings.guest_password_hash or "").strip()
        if guest_email and guest_hash:
            guest_action = await repo.upsert_by_email(
                email=guest_email,
                password_hash=guest_hash,
                role="guest",
                is_active=True,
            )
            results[guest_email] = guest_action
            print(f"Guest user {guest_action}: {guest_email}")
        elif guest_email or guest_hash:
            print(
                "Guest seed skipped: set both GUEST_EMAIL and GUEST_PASSWORD_HASH"
            )

        await session.commit()

    return results


async def seed_admin() -> bool:
    """Back-compat wrapper used by API lifespan. Returns True if any row created."""
    results = await seed_users()
    return any(action == "created" for action in results.values())


def main() -> None:
    asyncio.run(seed_users())


if __name__ == "__main__":
    main()
