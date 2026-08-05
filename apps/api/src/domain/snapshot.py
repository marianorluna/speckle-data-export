"""Domain entity: historical parameter snapshot for a BIM element."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ParameterSnapshot(BaseModel):
    """Point-in-time copy of an element's parameters tied to a Speckle commit."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    element_id: str
    commit_id: str
    parameters: str = Field(
        default="{}",
        description="Snapshot of parameters as JSON text",
    )
    created_at: datetime | None = None
