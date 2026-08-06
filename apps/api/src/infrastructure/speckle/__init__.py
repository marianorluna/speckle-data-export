"""Speckle package: GraphQL client + BIM element normalization."""

from src.infrastructure.speckle.client import SpeckleApiError, SpeckleClient
from src.infrastructure.speckle.normalize import NormalizedBimElement, normalize_speckle_object

__all__ = [
    "NormalizedBimElement",
    "SpeckleApiError",
    "SpeckleClient",
    "normalize_speckle_object",
]
