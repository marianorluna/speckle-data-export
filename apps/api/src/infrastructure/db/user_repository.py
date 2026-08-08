"""User persistence helpers for JWT auth."""

from __future__ import annotations

from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.db.models import UserModel
from src.infrastructure.db.repository import BaseRepository

UpsertAction = Literal["created", "updated"]


class UserRepository(BaseRepository[UserModel]):
    """CRUD + email lookup over the ``users`` table."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, UserModel)

    async def get_by_email(self, email: str) -> UserModel | None:
        statement = select(UserModel).where(UserModel.email == email)
        result = await self._session.execute(statement)
        return result.scalar_one_or_none()

    async def count(self) -> int:
        statement = select(func.count()).select_from(UserModel)
        result = await self._session.execute(statement)
        return int(result.scalar_one())

    async def upsert_by_email(
        self,
        *,
        email: str,
        password_hash: str,
        role: str,
        is_active: bool = True,
    ) -> UpsertAction:
        """Insert or update a user keyed by email. Returns created|updated."""
        existing = await self.get_by_email(email)
        if existing is not None:
            existing.password_hash = password_hash
            existing.role = role
            existing.is_active = is_active
            await self._session.flush()
            await self._session.refresh(existing)
            return "updated"

        await self.create(
            UserModel(
                email=email,
                password_hash=password_hash,
                role=role,
                is_active=is_active,
            )
        )
        return "created"
