"""Admin routes — manual Speckle ingest (JWT required)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from src.api.deps import CurrentUser, SessionDep, SettingsDep
from src.application.ingest_commit import IngestCommit
from src.infrastructure.db.element_repository import (
    ElementRepository,
    ProcessedCommitRepository,
    SnapshotRepository,
)
from src.infrastructure.speckle import SpeckleApiError, SpeckleClient
from src.infrastructure.ws_hub import broadcast_commit_processed

router = APIRouter()


class IngestRequest(BaseModel):
    stream_id: str | None = Field(
        default=None,
        description="Defaults to SPECKLE_STREAM_ID when omitted",
    )
    commit_id: str | None = Field(
        default=None,
        description="Defaults to the latest commit on the stream",
    )
    force: bool = Field(
        default=False,
        description="Re-ingest even if the commit was already processed",
    )


class IngestResponse(BaseModel):
    success: bool
    commit_id: str
    stream_id: str
    elements_processed: int
    elements_inserted: int
    elements_updated: int
    snapshots_created: int = 0
    skipped: bool = False
    message: str = ""


@router.post("/ingest", response_model=IngestResponse)
async def ingest_commit(
    body: IngestRequest,
    _current_user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> IngestResponse:
    """Trigger Speckle → SQLite ingest (admin / debug harness)."""
    stream_id = (body.stream_id or settings.speckle_stream_id or "").strip()
    if not stream_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="stream_id is required (body or SPECKLE_STREAM_ID)",
        )
    if not settings.speckle_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SPECKLE_TOKEN is not configured",
        )

    try:
        async with SpeckleClient(
            settings.speckle_server_url,
            settings.speckle_token,
        ) as client:
            use_case = IngestCommit(
                client,
                ElementRepository(session),
                SnapshotRepository(session),
                ProcessedCommitRepository(session),
            )
            result = await use_case.execute(
                stream_id,
                commit_id=body.commit_id,
                force=body.force,
                branch_name=settings.speckle_branch_name,
            )
            await session.commit()
    except SpeckleApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if not result.skipped:
        await broadcast_commit_processed(
            commit_id=result.commit_id,
            stream_id=result.stream_id,
            elements_processed=result.elements_processed,
            source="admin",
        )

    return IngestResponse(
        success=result.success,
        commit_id=result.commit_id,
        stream_id=result.stream_id,
        elements_processed=result.elements_processed,
        elements_inserted=result.elements_inserted,
        elements_updated=result.elements_updated,
        snapshots_created=result.snapshots_created,
        skipped=result.skipped,
        message=result.message,
    )
