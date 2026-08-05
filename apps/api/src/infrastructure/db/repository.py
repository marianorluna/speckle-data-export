"""Generic async repository with basic CRUD and upsert."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

ModelT = TypeVar("ModelT", bound=DeclarativeBase)


class BaseRepository(Generic[ModelT]):
    """CRUD helpers over an SQLAlchemy mapped model and an ``AsyncSession``."""

    def __init__(self, session: AsyncSession, model: type[ModelT]) -> None:
        self._session = session
        self._model = model

    async def get_by_id(self, entity_id: int) -> ModelT | None:
        return await self._session.get(self._model, entity_id)

    async def get_all(self, *, skip: int = 0, limit: int = 100) -> list[ModelT]:
        statement = select(self._model).offset(skip).limit(limit)
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def create(self, entity: ModelT) -> ModelT:
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def update(self, entity: ModelT) -> ModelT:
        merged = await self._session.merge(entity)
        await self._session.flush()
        await self._session.refresh(merged)
        return merged

    async def delete(self, entity_id: int) -> bool:
        entity = await self.get_by_id(entity_id)
        if entity is None:
            return False
        await self._session.delete(entity)
        await self._session.flush()
        return True

    async def upsert(
        self,
        *,
        filter_by: dict[str, Any],
        values: dict[str, Any],
    ) -> ModelT:
        """Insert a row or update the existing one matching ``filter_by``."""
        statement = select(self._model).filter_by(**filter_by)
        result = await self._session.execute(statement)
        existing = result.scalar_one_or_none()

        if existing is not None:
            for key, value in values.items():
                setattr(existing, key, value)
            await self._session.flush()
            await self._session.refresh(existing)
            return existing

        entity = self._model(**{**filter_by, **values})
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity
