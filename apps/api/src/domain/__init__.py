"""Domain entities (Pydantic) — independent of FastAPI and SQLAlchemy."""

from src.domain.element import BimElement, ElementSource
from src.domain.qc_finding import QcFinding, QcSeverity
from src.domain.snapshot import ParameterSnapshot
from src.domain.user import User

__all__ = [
    "BimElement",
    "ElementSource",
    "ParameterSnapshot",
    "QcFinding",
    "QcSeverity",
    "User",
]
