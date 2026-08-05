"""Domain entity: BIM element from Speckle or pyRevit push."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ElementSource = Literal["speckle", "revit_ws"]


class BimElement(BaseModel):
    """Validated BIM element snapshot (UniqueId of Revit as business key)."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    element_id: str
    category: str
    family: str | None = None
    type_name: str | None = None
    level: str | None = None
    parameters: str = Field(
        default="{}",
        description="Parameter dict serialized as JSON text for SQLite",
    )
    volume: float | None = None
    area: float | None = None
    length: float | None = None
    source: ElementSource = "speckle"
    commit_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
