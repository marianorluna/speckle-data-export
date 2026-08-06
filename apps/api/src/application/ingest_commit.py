"""Use case: ingest a Speckle commit into ``bim_elements`` (+ optional snapshots)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

from src.infrastructure.db.element_repository import (
    ElementRepository,
    ProcessedCommitRepository,
    SnapshotRepository,
)
from src.infrastructure.db.models import ParameterSnapshotModel
from src.infrastructure.speckle.normalize import NormalizedBimElement, parameters_to_json

logger = logging.getLogger(__name__)


class SpeckleElementsPort(Protocol):
    """Port for Speckle element extraction (satisfied by ``SpeckleClient``)."""

    async def get_bim_elements(
        self,
        stream_id: str,
        commit_id: str | None = None,
    ) -> tuple[str, list[NormalizedBimElement]]: ...


@dataclass(frozen=True)
class IngestResult:
    """Summary returned by ``IngestCommit.execute``."""

    success: bool
    commit_id: str
    stream_id: str
    elements_processed: int
    elements_inserted: int
    elements_updated: int
    snapshots_created: int
    skipped: bool = False
    message: str = ""


class IngestCommit:
    """Orchestrates Speckle fetch → upsert → snapshot → mark commit processed."""

    def __init__(
        self,
        speckle_client: SpeckleElementsPort,
        element_repo: ElementRepository,
        snapshot_repo: SnapshotRepository,
        processed_repo: ProcessedCommitRepository,
    ) -> None:
        self._speckle = speckle_client
        self._elements = element_repo
        self._snapshots = snapshot_repo
        self._processed = processed_repo

    async def execute(
        self,
        stream_id: str,
        commit_id: str | None = None,
        *,
        force: bool = False,
    ) -> IngestResult:
        resolved_commit_id, elements = await self._speckle.get_bim_elements(
            stream_id,
            commit_id=commit_id,
        )

        if not force and await self._processed.is_processed(resolved_commit_id):
            return IngestResult(
                success=True,
                commit_id=resolved_commit_id,
                stream_id=stream_id,
                elements_processed=0,
                elements_inserted=0,
                elements_updated=0,
                snapshots_created=0,
                skipped=True,
                message="Commit already processed",
            )

        inserted = 0
        updated = 0
        snapshot_rows: list[ParameterSnapshotModel] = []
        create_snapshots = not await self._snapshots.exists_for_commit(resolved_commit_id)

        for element in elements:
            values = {
                "category": element["category"],
                "family": element.get("family"),
                "type_name": element.get("type_name"),
                "level": element.get("level"),
                "parameters": parameters_to_json(dict(element.get("parameters") or {})),
                "volume": element.get("volume"),
                "area": element.get("area"),
                "length": element.get("length"),
                "source": "speckle",
                "commit_id": resolved_commit_id,
            }
            _, created = await self._elements.upsert_element(
                element_id=element["element_id"],
                values=values,
            )
            if created:
                inserted += 1
            else:
                updated += 1

            if create_snapshots:
                snapshot_rows.append(
                    ParameterSnapshotModel(
                        element_id=element["element_id"],
                        commit_id=resolved_commit_id,
                        parameters=values["parameters"],
                    )
                )

        snapshots_created = 0
        if create_snapshots and snapshot_rows:
            # Snapshots FK to bim_elements.element_id — rows already upserted above.
            snapshots_created = await self._snapshots.create_many(snapshot_rows)

        await self._processed.mark_processed(
            commit_id=resolved_commit_id,
            stream_id=stream_id,
            elements_count=len(elements),
        )

        logger.info(
            "IngestCommit done: commit=%s inserted=%s updated=%s snapshots=%s",
            resolved_commit_id,
            inserted,
            updated,
            snapshots_created,
        )
        return IngestResult(
            success=True,
            commit_id=resolved_commit_id,
            stream_id=stream_id,
            elements_processed=len(elements),
            elements_inserted=inserted,
            elements_updated=updated,
            snapshots_created=snapshots_created,
        )
