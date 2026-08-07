"""REST routes: aggregated KPIs and ingest snapshot history."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from src.api.deps import SessionDep, SettingsDep
from src.api.schemas import ApiDataResponse, KpiOut, SnapshotOut
from src.infrastructure.db.element_repository import (
    ElementRepository,
    ProcessedCommitRepository,
)

router = APIRouter()


def _model_display_name(branch_name: str) -> str:
    """``structure/snowdon-towers-r27`` → ``snowdon-towers-r27``."""
    text = (branch_name or "").strip()
    if not text:
        return ""
    return text.rsplit("/", 1)[-1]


@router.get("", response_model=ApiDataResponse[KpiOut])
async def get_kpis(
    session: SessionDep,
    settings: SettingsDep,
) -> ApiDataResponse[KpiOut]:
    """Model-wide metrics computed in SQL."""
    repo = ElementRepository(session)
    payload = await repo.compute_kpis()
    payload["model_name"] = _model_display_name(settings.speckle_branch_name) or None
    return ApiDataResponse(data=KpiOut.model_validate(payload))


@router.get("/snapshots", response_model=ApiDataResponse[list[SnapshotOut]])
async def list_snapshots(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ApiDataResponse[list[SnapshotOut]]:
    """Latest processed Speckle commits with element counts."""
    repo = ProcessedCommitRepository(session)
    rows = await repo.list_recent(limit=limit)
    return ApiDataResponse(
        data=[SnapshotOut.model_validate(row) for row in rows],
    )
