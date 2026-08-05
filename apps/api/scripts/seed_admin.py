"""Seed the single admin user from ADMIN_EMAIL / ADMIN_PASSWORD_HASH.

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


async def seed_admin() -> bool:
    """Insert the admin user if the ``users`` table is empty. Returns True if created."""
    from src.api.deps import get_settings
    from src.infrastructure.db.models import UserModel
    from src.infrastructure.db.session import get_session_factory, init_engine
    from src.infrastructure.db.user_repository import UserRepository

    settings = get_settings()
    if not settings.admin_email:
        raise RuntimeError("ADMIN_EMAIL is required in .env")
    if not settings.admin_password_hash:
        raise RuntimeError("ADMIN_PASSWORD_HASH is required in .env")

    init_engine()
    factory = get_session_factory()
    async with factory() as session:
        repo = UserRepository(session)
        if await repo.count() > 0:
            print("Admin seed skipped: users table already has rows.")
            return False

        await repo.create(
            UserModel(
                email=settings.admin_email,
                password_hash=settings.admin_password_hash,
                is_active=True,
            )
        )
        await session.commit()
        print(f"Admin user created: {settings.admin_email}")
        return True


def main() -> None:
    asyncio.run(seed_admin())


if __name__ == "__main__":
    main()
