"""Authenticated Speckle viewer config (server URL, stream, PAT for private loads)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from src.api.deps import CurrentUser, SettingsDep
from src.api.schemas import ApiDataResponse
from src.infrastructure.speckle import SpeckleApiError, SpeckleClient

router = APIRouter()


class SpeckleViewerConfigOut(BaseModel):
    """Frontend payload to init ``@speckle/viewer`` without baking the PAT into Vite."""

    server_url: str
    stream_id: str
    token: str
    branch_name: str
    # Latest commit on branch_name (avoids loading another model in the same project).
    commit_id: str | None = None


@router.get("/viewer-config", response_model=ApiDataResponse[SpeckleViewerConfigOut])
async def get_viewer_config(
    _user: CurrentUser,
    settings: SettingsDep,
) -> ApiDataResponse[SpeckleViewerConfigOut]:
    """Return Speckle connection details for the logged-in admin.

    Resolves the latest commit on ``SPECKLE_BRANCH_NAME`` so the viewer does not
    accidentally load another model (e.g. ``main``) in the same project.
    """
    server_url = settings.speckle_server_url.rstrip("/")
    stream_id = settings.speckle_stream_id
    branch_name = (settings.speckle_branch_name or "main").strip() or "main"
    commit_id: str | None = None

    if stream_id and settings.speckle_token:
        try:
            async with SpeckleClient(server_url, settings.speckle_token) as client:
                commit = await client.get_latest_commit(
                    stream_id,
                    branch_name=branch_name,
                )
                commit_id = str(commit["id"])
        except (SpeckleApiError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Could not resolve Speckle commit for branch '{branch_name}': {exc}",
            ) from exc

    return ApiDataResponse(
        data=SpeckleViewerConfigOut(
            server_url=server_url,
            stream_id=stream_id,
            token=settings.speckle_token,
            branch_name=branch_name,
            commit_id=commit_id,
        ),
    )
