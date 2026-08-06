"""Async Speckle GraphQL adapter (httpx) — no heavy ``specklepy`` receive tree."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from src.infrastructure.speckle.normalize import NormalizedBimElement, normalize_speckle_object

logger = logging.getLogger(__name__)

_CHILDREN_PAGE_SIZE = 500
_SELECT_FIELDS = [
    "category",
    "level",
    "name",
    "family",
    "type",
    "typeName",
    "applicationId",
    "volume",
    "area",
    "length",
    "properties",
    "parameters",
]


class SpeckleApiError(RuntimeError):
    """Raised when Speckle GraphQL returns errors or an unexpected payload."""


class SpeckleClient:
    """Thin GraphQL client for stream/commit metadata and BIM element extraction."""

    def __init__(
        self,
        server_url: str,
        token: str,
        *,
        timeout: float = 120.0,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        if not token:
            raise ValueError("SPECKLE_TOKEN is required")
        self._server_url = server_url.rstrip("/")
        self._token = token
        self._timeout = timeout
        self._http = http_client
        self._owns_http = http_client is None

    @property
    def graphql_url(self) -> str:
        return f"{self._server_url}/graphql"

    async def __aenter__(self) -> SpeckleClient:
        if self._http is None:
            self._http = httpx.AsyncClient(
                timeout=self._timeout,
                headers={
                    "Authorization": f"Bearer {self._token}",
                    "Content-Type": "application/json",
                },
            )
        return self

    async def __aexit__(self, *args: object) -> None:
        if self._owns_http and self._http is not None:
            await self._http.aclose()
            self._http = None

    async def get_stream(self, stream_id: str) -> dict[str, Any]:
        """Return stream metadata (id, name, description)."""
        data = await self._graphql(
            """
            query($id: String!) {
              stream(id: $id) {
                id
                name
                description
              }
            }
            """,
            {"id": stream_id},
        )
        stream = data.get("stream")
        if not isinstance(stream, dict):
            raise SpeckleApiError(f"Stream not found: {stream_id}")
        return stream

    async def get_branches(self, stream_id: str) -> list[dict[str, Any]]:
        """List branches for a stream."""
        data = await self._graphql(
            """
            query($id: String!) {
              stream(id: $id) {
                branches(limit: 50) {
                  items { id name description }
                }
              }
            }
            """,
            {"id": stream_id},
        )
        stream = data.get("stream") or {}
        items = ((stream.get("branches") or {}).get("items")) or []
        return [item for item in items if isinstance(item, dict)]

    async def get_latest_commit(self, stream_id: str) -> dict[str, Any]:
        """Return the latest commit on ``main``, falling back to any branch."""
        data = await self._graphql(
            """
            query($id: String!) {
              stream(id: $id) {
                branch(name: "main") {
                  commits(limit: 1) {
                    items {
                      id
                      message
                      referencedObject
                      createdAt
                      authorName
                    }
                  }
                }
                branches(limit: 20) {
                  items {
                    name
                    commits(limit: 1) {
                      items {
                        id
                        message
                        referencedObject
                        createdAt
                        authorName
                      }
                    }
                  }
                }
              }
            }
            """,
            {"id": stream_id},
        )
        stream = data.get("stream") or {}
        main_items = (((stream.get("branch") or {}).get("commits") or {}).get("items")) or []
        if main_items and isinstance(main_items[0], dict):
            return main_items[0]

        for branch in ((stream.get("branches") or {}).get("items")) or []:
            items = ((branch.get("commits") or {}).get("items")) or []
            if items and isinstance(items[0], dict):
                logger.info(
                    "No commits on main; using branch %s",
                    branch.get("name"),
                )
                return items[0]

        raise SpeckleApiError(f"No commits found for stream {stream_id}")

    async def get_commit(self, stream_id: str, commit_id: str) -> dict[str, Any]:
        """Fetch a specific commit by id."""
        data = await self._graphql(
            """
            query($streamId: String!, $id: String!) {
              stream(id: $streamId) {
                commit(id: $id) {
                  id
                  message
                  referencedObject
                  createdAt
                  authorName
                }
              }
            }
            """,
            {"streamId": stream_id, "id": commit_id},
        )
        commit = ((data.get("stream") or {}).get("commit"))
        if not isinstance(commit, dict):
            raise SpeckleApiError(f"Commit not found: {commit_id}")
        return commit

    async def get_commit_object(self, stream_id: str, object_id: str) -> dict[str, Any]:
        """Return the root object ``data`` payload for a commit referenced object."""
        data = await self._graphql(
            """
            query($streamId: String!, $id: String!) {
              stream(id: $streamId) {
                object(id: $id) {
                  id
                  data
                }
              }
            }
            """,
            {"streamId": stream_id, "id": object_id},
        )
        obj = ((data.get("stream") or {}).get("object")) or {}
        payload = obj.get("data")
        if not isinstance(payload, dict):
            raise SpeckleApiError(f"Object not found or empty: {object_id}")
        return payload

    async def get_bim_elements(
        self,
        stream_id: str,
        commit_id: str | None = None,
    ) -> tuple[str, list[NormalizedBimElement]]:
        """Fetch and normalize BIM elements for a commit.

        Returns ``(resolved_commit_id, elements)``.
        """
        if commit_id:
            commit = await self.get_commit(stream_id, commit_id)
        else:
            commit = await self.get_latest_commit(stream_id)

        resolved_commit_id = str(commit["id"])
        object_id = commit.get("referencedObject")
        if not isinstance(object_id, str) or not object_id:
            raise SpeckleApiError(f"Commit {resolved_commit_id} has no referencedObject")

        raw_objects = await self._fetch_object_children(stream_id, object_id)
        elements: list[NormalizedBimElement] = []
        seen: set[str] = set()
        for raw in raw_objects:
            normalized = normalize_speckle_object(raw)
            if normalized is None:
                continue
            if normalized["element_id"] in seen:
                continue
            seen.add(normalized["element_id"])
            elements.append(normalized)

        logger.info(
            "Speckle normalize: stream=%s commit=%s raw=%s elements=%s",
            stream_id,
            resolved_commit_id,
            len(raw_objects),
            len(elements),
        )
        return resolved_commit_id, elements

    async def _fetch_object_children(
        self,
        stream_id: str,
        object_id: str,
    ) -> list[dict[str, Any]]:
        """Page through ``project.object.children`` (stream id == project id on Speckle)."""
        collected: list[dict[str, Any]] = []
        cursor: str | None = None

        while True:
            variables: dict[str, Any] = {
                "projectId": stream_id,
                "objectId": object_id,
                "select": _SELECT_FIELDS,
                "limit": _CHILDREN_PAGE_SIZE,
            }
            if cursor:
                variables["cursor"] = cursor

            data = await self._graphql(
                """
                query(
                  $projectId: String!
                  $objectId: String!
                  $select: [String!]
                  $limit: Int!
                  $cursor: String
                ) {
                  project(id: $projectId) {
                    object(id: $objectId) {
                      children(select: $select, limit: $limit, cursor: $cursor) {
                        totalCount
                        cursor
                        objects { data }
                      }
                    }
                  }
                }
                """,
                variables,
            )
            children = (((data.get("project") or {}).get("object") or {}).get("children")) or {}
            objects = children.get("objects") or []
            for item in objects:
                payload = item.get("data") if isinstance(item, dict) else None
                if isinstance(payload, dict):
                    collected.append(payload)

            next_cursor = children.get("cursor")
            if not next_cursor or next_cursor == cursor or len(objects) == 0:
                break
            cursor = str(next_cursor)

        return collected

    async def _graphql(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        client = self._http
        if client is None:
            raise RuntimeError("SpeckleClient must be used as an async context manager")

        response = await client.post(
            self.graphql_url,
            json={"query": query, "variables": variables},
        )
        response.raise_for_status()
        payload = response.json()
        errors = payload.get("errors")
        if errors:
            raise SpeckleApiError(str(errors))
        data = payload.get("data")
        if not isinstance(data, dict):
            raise SpeckleApiError("GraphQL response missing data")
        return data
