"""Repositories for BIM elements, snapshots, and processed Speckle commits."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.db.models import (
    BimElementModel,
    ParameterSnapshotModel,
    ProcessedCommitModel,
)
from src.infrastructure.db.repository import BaseRepository


class ElementRepository(BaseRepository[BimElementModel]):
    """Persistence for ``bim_elements`` keyed by Revit ``element_id``."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, BimElementModel)

    async def get_by_element_id(self, element_id: str) -> BimElementModel | None:
        statement = select(BimElementModel).where(BimElementModel.element_id == element_id)
        result = await self._session.execute(statement)
        return result.scalar_one_or_none()

    async def upsert_element(
        self,
        *,
        element_id: str,
        values: dict[str, object],
    ) -> tuple[BimElementModel, bool]:
        """Insert or update by ``element_id``. Returns ``(row, created)``."""
        existing = await self.get_by_element_id(element_id)
        created = existing is None
        row = await self.upsert(filter_by={"element_id": element_id}, values=values)
        return row, created


class SnapshotRepository(BaseRepository[ParameterSnapshotModel]):
    """Historical parameter snapshots tied to Speckle commits."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ParameterSnapshotModel)

    async def exists_for_commit(self, commit_id: str) -> bool:
        statement = (
            select(ParameterSnapshotModel.id)
            .where(ParameterSnapshotModel.commit_id == commit_id)
            .limit(1)
        )
        result = await self._session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def create_many(self, rows: list[ParameterSnapshotModel]) -> int:
        if not rows:
            return 0
        self._session.add_all(rows)
        await self._session.flush()
        return len(rows)


class ProcessedCommitRepository(BaseRepository[ProcessedCommitModel]):
    """Tracks Speckle commits already ingested (polling idempotency)."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ProcessedCommitModel)

    async def get_by_commit_id(self, commit_id: str) -> ProcessedCommitModel | None:
        return await self._session.get(ProcessedCommitModel, commit_id)

    async def is_processed(self, commit_id: str) -> bool:
        return await self.get_by_commit_id(commit_id) is not None

    async def mark_processed(
        self,
        *,
        commit_id: str,
        stream_id: str,
        elements_count: int,
    ) -> ProcessedCommitModel:
        return await self.upsert(
            filter_by={"commit_id": commit_id},
            values={
                "stream_id": stream_id,
                "elements_count": elements_count,
            },
        )
