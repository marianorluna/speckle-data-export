"""Repositories for BIM elements, snapshots, processed commits, and QC findings."""

from __future__ import annotations

import re
from datetime import datetime

from typing import Any

from sqlalchemy import Select, and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.db.models import (
    BimElementModel,
    ParameterSnapshotModel,
    ProcessedCommitModel,
    QcFindingModel,
)
from src.infrastructure.db.repository import BaseRepository

_SAFE_JSON_KEY = re.compile(r"^[A-Za-z0-9_ ]{1,128}$")


def _json_param_path(param_name: str) -> str:
    """Build a SQLite ``json_extract`` path for a flat parameter key."""
    if not _SAFE_JSON_KEY.match(param_name):
        raise ValueError(
            "missing_param must be alphanumeric / underscore / space (max 128 chars)"
        )
    if " " in param_name:
        return f'$."{param_name}"'
    return f"$.{param_name}"


def _missing_param_clause(param_name: str):
    path = _json_param_path(param_name)
    extracted = func.json_extract(BimElementModel.parameters, path)
    return or_(
        extracted.is_(None),
        extracted == "",
        extracted == "null",
    )


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

    def _filter_statement(
        self,
        *,
        category: str | None = None,
        level: str | None = None,
        search: str | None = None,
        missing_param: str | None = None,
    ) -> Select[tuple[BimElementModel]]:
        statement = select(BimElementModel)
        conditions: list[object] = []
        if category is not None:
            conditions.append(BimElementModel.category == category)
        if level is not None:
            conditions.append(BimElementModel.level == level)
        if search:
            pattern = f"%{search}%"
            conditions.append(
                or_(
                    BimElementModel.family.ilike(pattern),
                    BimElementModel.type_name.ilike(pattern),
                    BimElementModel.element_id.ilike(pattern),
                )
            )
        if missing_param:
            conditions.append(_missing_param_clause(missing_param))
        if conditions:
            statement = statement.where(and_(*conditions))
        return statement

    async def list_elements(
        self,
        *,
        category: str | None = None,
        level: str | None = None,
        search: str | None = None,
        missing_param: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[BimElementModel], int]:
        """Return filtered page and total matching count."""
        base = self._filter_statement(
            category=category,
            level=level,
            search=search,
            missing_param=missing_param,
        )
        count_stmt = select(func.count()).select_from(base.subquery())
        total = int((await self._session.execute(count_stmt)).scalar_one())

        page_stmt = (
            base.order_by(BimElementModel.id)
            .offset(skip)
            .limit(limit)
        )
        rows = list((await self._session.execute(page_stmt)).scalars().all())
        return rows, total

    async def element_application_id_map(self) -> dict[str, str]:
        """Map ``element_id`` → Speckle ``applicationId`` (same UniqueId today).

        Selection in ``@speckle/viewer`` uses ``applicationId``; we do not store
        Speckle object hashes (they change per commit). Identity map is intentional.
        """
        statement = select(BimElementModel.element_id).order_by(BimElementModel.element_id)
        rows = (await self._session.execute(statement)).scalars().all()
        return {element_id: element_id for element_id in rows}

    async def count_by_category(self) -> list[tuple[str, int]]:
        statement = (
            select(BimElementModel.category, func.count())
            .group_by(BimElementModel.category)
            .order_by(func.count().desc(), BimElementModel.category)
        )
        result = await self._session.execute(statement)
        return [(str(cat), int(count)) for cat, count in result.all()]

    async def count_by_level(self) -> list[tuple[str | None, int]]:
        statement = (
            select(BimElementModel.level, func.count())
            .group_by(BimElementModel.level)
            .order_by(func.count().desc())
        )
        result = await self._session.execute(statement)
        return [(lvl, int(count)) for lvl, count in result.all()]

    async def compute_kpis(self) -> dict[str, object]:
        """Aggregate KPIs with SQL (count / sum / group_by / json_extract)."""
        total = int(
            (
                await self._session.execute(
                    select(func.count()).select_from(BimElementModel)
                )
            ).scalar_one()
        )

        by_category = {
            category: count for category, count in await self.count_by_category()
        }
        by_level: dict[str, int] = {}
        for level, count in await self.count_by_level():
            key = level if level is not None else "(none)"
            by_level[key] = count

        missing_fire = int(
            (
                await self._session.execute(
                    select(func.count())
                    .select_from(BimElementModel)
                    .where(_missing_param_clause("fire_rating"))
                )
            ).scalar_one()
        )
        missing_level = int(
            (
                await self._session.execute(
                    select(func.count())
                    .select_from(BimElementModel)
                    .where(
                        or_(
                            BimElementModel.level.is_(None),
                            BimElementModel.level == "",
                        )
                    )
                )
            ).scalar_one()
        )

        volume_sum, area_sum, last_updated = (
            await self._session.execute(
                select(
                    func.coalesce(func.sum(BimElementModel.volume), 0.0),
                    func.coalesce(func.sum(BimElementModel.area), 0.0),
                    func.max(BimElementModel.updated_at),
                )
            )
        ).one()

        last_commit = (
            await self._session.execute(
                select(ProcessedCommitModel.commit_id)
                .order_by(ProcessedCommitModel.processed_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        return {
            "total_elements": total,
            "elements_by_category": by_category,
            "elements_by_level": by_level,
            "missing_fire_rating": missing_fire,
            "missing_level": missing_level,
            "total_volume_m3": float(volume_sum or 0.0),
            "total_area_m2": float(area_sum or 0.0),
            "last_updated": last_updated if isinstance(last_updated, datetime) else None,
            "last_commit_id": last_commit,
        }

    async def execute_raw_sql(self, sql: str) -> list[dict[str, Any]]:
        """
        Run a pre-validated read-only SQL statement and return row mappings.

        Caller MUST pass SQL through ``application.sql_guard.is_safe_sql`` first.
        """
        result = await self._session.execute(text(sql))
        return [dict(row) for row in result.mappings().all()]


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
    """Tracks Speckle commits already ingested (polling / ingest idempotency)."""

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

    async def list_recent(self, *, limit: int = 20) -> list[ProcessedCommitModel]:
        statement = (
            select(ProcessedCommitModel)
            .order_by(ProcessedCommitModel.processed_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(statement)
        return list(result.scalars().all())


class QcFindingRepository(BaseRepository[QcFindingModel]):
    """Persistence for quality-control findings."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, QcFindingModel)

    async def list_findings(
        self,
        *,
        resolved: bool | None = None,
        severity: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[QcFindingModel], int]:
        statement = select(QcFindingModel)
        conditions: list[object] = []
        if resolved is not None:
            conditions.append(QcFindingModel.resolved == resolved)
        if severity is not None:
            conditions.append(QcFindingModel.severity == severity)
        if conditions:
            statement = statement.where(and_(*conditions))

        count_stmt = select(func.count()).select_from(statement.subquery())
        total = int((await self._session.execute(count_stmt)).scalar_one())

        page_stmt = (
            statement.order_by(QcFindingModel.id.desc()).offset(skip).limit(limit)
        )
        rows = list((await self._session.execute(page_stmt)).scalars().all())
        return rows, total

    async def mark_resolved(self, finding_id: int) -> QcFindingModel | None:
        row = await self.get_by_id(finding_id)
        if row is None:
            return None
        row.resolved = True
        await self._session.flush()
        await self._session.refresh(row)
        return row
