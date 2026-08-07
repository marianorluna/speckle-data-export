"""Pydantic response schemas for the REST API (not domain entities)."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

T = TypeVar("T")


class ElementOut(BaseModel):
    """BIM element as returned by the API (parameters as dict)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    element_id: str
    category: str
    family: str | None = None
    type_name: str | None = None
    level: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    volume: float | None = None
    area: float | None = None
    length: float | None = None
    source: str
    updated_at: datetime

    @field_validator("parameters", mode="before")
    @classmethod
    def _deserialize_parameters(cls, value: object) -> dict[str, Any]:
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            if not value.strip():
                return {}
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        return {}


class CategoryCountOut(BaseModel):
    category: str
    count: int


class LevelCountOut(BaseModel):
    level: str | None
    count: int


class KpiOut(BaseModel):
    """Aggregated model metrics (matches GET /api/kpis payload)."""

    total_elements: int
    elements_by_category: dict[str, int]
    elements_by_level: dict[str, int]
    missing_fire_rating: int
    missing_level: int
    total_volume_m3: float
    total_area_m2: float
    last_updated: datetime | None = None
    last_commit_id: str | None = None
    # Speckle model / branch display name (from SPECKLE_BRANCH_NAME).
    model_name: str | None = None


class SnapshotOut(BaseModel):
    """Processed Speckle commit (ingest history)."""

    model_config = ConfigDict(from_attributes=True)

    commit_id: str
    processed_at: datetime
    elements_count: int


class QcFindingOut(BaseModel):
    """Quality-control finding row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    element_id: str
    rule: str
    severity: str
    message: str
    resolved: bool
    created_at: datetime


class ApiListResponse(BaseModel, Generic[T]):
    """Paginated list envelope."""

    success: bool = True
    data: list[T]
    total: int
    skip: int = 0
    limit: int = 100


class ApiDataResponse(BaseModel, Generic[T]):
    """Single-payload envelope."""

    success: bool = True
    data: T
