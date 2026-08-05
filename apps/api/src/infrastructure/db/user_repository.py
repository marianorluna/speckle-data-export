"""User persistence helpers for JWT auth."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.db.models import UserModel
from src.infrastructure.db.repository import BaseRepository


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
