"""Authenticated Speckle viewer config (server URL, stream, read-oriented token)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from src.api.deps import CurrentUser, SettingsDep
from src.api.schemas import ApiDataResponse
from src.infrastructure.speckle import SpeckleApiError, SpeckleClient

router = APIRouter()


class SpeckleViewerConfigOut(BaseModel):
    """Frontend payload to init ``@speckle/viewer`` without baking the write PAT into Vite."""

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
    """Return Speckle connection details for any logged-in user (admin or guest).

    Uses ``SPECKLE_VIEWER_TOKEN`` when set (read-oriented PAT for the browser).
    Resolves the latest commit on ``SPECKLE_BRANCH_NAME`` so the viewer does not
    accidentally load another model (e.g. ``main``) in the same project.
    """
    server_url = settings.speckle_server_url.rstrip("/")
    stream_id = settings.speckle_stream_id
    branch_name = (settings.speckle_branch_name or "main").strip() or "main"
    viewer_token = settings.effective_speckle_viewer_token
    commit_id: str | None = None

    # Prefer server-side write token to resolve commit; fall back to viewer token.
    resolve_token = settings.speckle_token.strip() or viewer_token
    if stream_id and resolve_token:
        try:
            async with SpeckleClient(server_url, resolve_token) as client:
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
            token=viewer_token,
            branch_name=branch_name,
            commit_id=commit_id,
        ),
    )
