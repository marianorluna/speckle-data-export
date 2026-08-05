"""Domain entity: quality-control finding on a BIM element."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


QcSeverity = Literal["error", "warning", "info"]


class QcFinding(BaseModel):
    """QC rule violation detected against a BIM element."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    element_id: str
    rule: str
    severity: QcSeverity
    message: str
    resolved: bool = False
    created_at: datetime | None = None
