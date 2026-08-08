"""REST routes: quality-control findings (read public, resolve JWT)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import AdminUser, SessionDep
from src.api.schemas import ApiDataResponse, ApiListResponse, QcFindingOut
from src.infrastructure.db.element_repository import QcFindingRepository

router = APIRouter()


@router.get("/findings", response_model=ApiListResponse[QcFindingOut])
async def list_findings(
    session: SessionDep,
    resolved: Annotated[bool | None, Query()] = None,
    severity: Annotated[str | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
) -> ApiListResponse[QcFindingOut]:
    """List QC findings with optional filters (public read)."""
    repo = QcFindingRepository(session)
    rows, total = await repo.list_findings(
        resolved=resolved,
        severity=severity,
        skip=skip,
        limit=limit,
    )
    return ApiListResponse(
        data=[QcFindingOut.model_validate(row) for row in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.put("/findings/{finding_id}/resolve", response_model=ApiDataResponse[QcFindingOut])
async def resolve_finding(
    finding_id: int,
    _admin: AdminUser,
    session: SessionDep,
) -> ApiDataResponse[QcFindingOut]:
    """Mark a finding as resolved (admin role required)."""
    repo = QcFindingRepository(session)
    row = await repo.mark_resolved(finding_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"QC finding not found: {finding_id}",
        )
    await session.commit()
    return ApiDataResponse(data=QcFindingOut.model_validate(row))
