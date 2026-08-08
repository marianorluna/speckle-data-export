"""Pure helpers: Speckle object dict → normalized BIM element row."""

from __future__ import annotations

import json
from typing import Any, TypedDict


class NormalizedBimElement(TypedDict):
    """Flat element ready for ``bim_elements`` upsert."""

    element_id: str
    category: str
    family: str | None
    type_name: str | None
    level: str | None
    parameters: dict[str, Any]
    volume: float | None
    area: float | None
    length: float | None


def normalize_speckle_object(raw: dict[str, Any]) -> NormalizedBimElement | None:
    """Map one Speckle object to a normalized element, or ``None`` if not a BIM element.

    Keeps objects that expose a ``category`` (skips pure geometry / materials).
    Requires a stable Revit identity (``applicationId`` / UniqueId); otherwise skips.
    """
    if not isinstance(raw, dict):
        return None

    props = raw.get("properties") if isinstance(raw.get("properties"), dict) else {}
    category = _as_str(raw.get("category")) or _as_str(props.get("category"))
    if not category:
        return None

    element_id = _extract_element_id(raw, props)
    if not element_id:
        return None

    parameters = _extract_parameters(raw, props)
    family = (
        _as_str(raw.get("family"))
        or _as_str(props.get("family"))
        or _as_str(props.get("Family"))
    )
    type_name = (
        _as_str(raw.get("type"))
        or _as_str(raw.get("typeName"))
        or _as_str(props.get("type"))
        or _as_str(props.get("typeName"))
        or _as_str(props.get("Type"))
    )
    level = _extract_level(raw, props, parameters)
    volume = (
        _as_float(raw.get("volume"))
        or _as_float(props.get("volume"))
        or _as_float(parameters.get("volume"))
        or _as_float(parameters.get("Volume"))
    )
    area = (
        _as_float(raw.get("area"))
        or _as_float(props.get("area"))
        or _as_float(parameters.get("area"))
        or _as_float(parameters.get("Area"))
    )
    length = (
        _as_float(raw.get("length"))
        or _as_float(props.get("length"))
        or _as_float(parameters.get("length"))
        or _as_float(parameters.get("Length"))
    )

    return NormalizedBimElement(
        element_id=element_id,
        category=category,
        family=family,
        type_name=type_name,
        level=level,
        parameters=parameters,
        volume=volume,
        area=area,
        length=length,
    )


def parameters_to_json(parameters: dict[str, Any]) -> str:
    """Serialize parameters for SQLite ``Text`` columns."""
    return json.dumps(parameters, ensure_ascii=False, default=str)


def _extract_element_id(raw: dict[str, Any], props: dict[str, Any]) -> str | None:
    candidates: list[Any] = [
        raw.get("applicationId"),
        props.get("UniqueId"),
        props.get("uniqueId"),
        props.get("elementId"),
        props.get("ElementId"),
    ]
    parameters = props.get("Parameters")
    if isinstance(parameters, dict):
        candidates.extend(_dig_param_values(parameters, ("UniqueId", "uniqueId", "ElementId")))

    for value in candidates:
        text = _as_str(value)
        if text:
            return text
    return None


def _extract_level(
    raw: dict[str, Any],
    props: dict[str, Any],
    parameters: dict[str, Any],
) -> str | None:
    for value in (
        raw.get("level"),
        raw.get("Level"),
        props.get("level"),
        props.get("Level"),
        parameters.get("level"),
        parameters.get("Level"),
        parameters.get("Reference Level"),
    ):
        text = _as_str(value)
        if text:
            return text
    return None


def _extract_parameters(raw: dict[str, Any], props: dict[str, Any]) -> dict[str, Any]:
    """Prefer a flat-ish parameters map; fall back to full ``properties``."""
    for key in ("parameters", "Parameters"):
        block = raw.get(key)
        if isinstance(block, dict) and block:
            return _flatten_parameter_block(block)
        block = props.get(key)
        if isinstance(block, dict) and block:
            return _flatten_parameter_block(block)
    return dict(props) if props else {}


def _flatten_parameter_block(block: dict[str, Any]) -> dict[str, Any]:
    """Flatten Speckle/Revit nested parameter groups into ``name → value``."""
    flat: dict[str, Any] = {}

    def walk(node: Any, path: tuple[str, ...] = ()) -> None:
        if isinstance(node, dict):
            if "value" in node and len(node) <= 4:
                name = path[-1] if path else "value"
                flat[name] = node.get("value")
                return
            for key, child in node.items():
                if isinstance(key, str):
                    walk(child, (*path, key))
            return
        if path:
            flat[path[-1]] = node

    walk(block)
    return flat or dict(block)


def _dig_param_values(node: Any, names: tuple[str, ...]) -> list[Any]:
    found: list[Any] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key in names:
                found.append(value.get("value") if isinstance(value, dict) else value)
            found.extend(_dig_param_values(value, names))
    elif isinstance(node, list):
        for item in node:
            found.extend(_dig_param_values(item, names))
    return found


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, dict):
        for key in ("name", "value", "Name", "Value"):
            nested = value.get(key)
            if isinstance(nested, str) and nested.strip():
                return nested.strip()
        return None
    if isinstance(value, (int, float, bool)):
        return str(value)
    return None


def _as_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, dict) and "value" in value:
        return _as_float(value.get("value"))
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None
