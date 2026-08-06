"""Unit tests for Speckle → BIM element normalization (no network)."""

from src.infrastructure.speckle.normalize import normalize_speckle_object


def test_normalize_revit_like_object() -> None:
    raw = {
        "category": "Doors",
        "applicationId": "uid-123",
        "family": "Single-Flush",
        "type": "0915 x 2134mm",
        "level": {"name": "Level 1"},
        "properties": {
            "volume": 0.5,
            "Parameters": {
                "Identity Data": {
                    "UniqueId": {"value": "uid-123"},
                }
            },
        },
    }
    result = normalize_speckle_object(raw)
    assert result is not None
    assert result["element_id"] == "uid-123"
    assert result["category"] == "Doors"
    assert result["family"] == "Single-Flush"
    assert result["type_name"] == "0915 x 2134mm"
    assert result["level"] == "Level 1"
    assert result["volume"] == 0.5


def test_normalize_skips_geometry_without_category() -> None:
    assert normalize_speckle_object({"speckle_type": "Mesh", "applicationId": "x"}) is None


def test_normalize_skips_missing_element_id() -> None:
    assert normalize_speckle_object({"category": "Walls"}) is None
