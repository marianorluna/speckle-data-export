# -*- coding: utf-8 -*-
"""Extract normalized element payloads for /ws/revit (RevitElementPayload)."""

from Autodesk.Revit.DB import BuiltInParameter, StorageType


def _element_id_int(element_id):
    """ElementId.Value (Revit 2024+) or .IntegerValue (older)."""
    value = getattr(element_id, "Value", None)
    if value is None:
        value = getattr(element_id, "IntegerValue", None)
    return value


def extract_element_data(element):
    """Return a dict matching backend ``RevitElementPayload``, or None if skip."""
    if element is None or element.Category is None:
        return None

    category_name = element.Category.Name
    if hasattr(element, "UniqueId") and element.UniqueId:
        element_id = str(element.UniqueId)
    else:
        element_id = str(_element_id_int(element.Id))

    level_name = None
    level_param = None
    for _name in ("LEVEL_PARAM", "SCHEDULE_LEVEL_PARAM", "INSTANCE_REFERENCE_LEVEL_PARAM"):
        _bi = getattr(BuiltInParameter, _name, None)
        if _bi is None:
            continue
        try:
            level_param = element.get_Parameter(_bi)
        except Exception:
            level_param = None
        if level_param is not None:
            break
    if level_param is not None and level_param.HasValue:
        # Prefer resolved level name when the param stores an ElementId.
        if level_param.StorageType == StorageType.ElementId:
            level_id = level_param.AsElementId()
            doc = element.Document
            if doc is not None and level_id is not None:
                level_el = doc.GetElement(level_id)
                if level_el is not None and hasattr(level_el, "Name"):
                    level_name = level_el.Name
        else:
            as_str = level_param.AsString()
            if as_str:
                level_name = as_str

    family_name = None
    type_name = None
    if hasattr(element, "Symbol") and element.Symbol is not None:
        symbol = element.Symbol
        family_name = getattr(symbol, "FamilyName", None)
        type_name = getattr(symbol, "Name", None)
    elif hasattr(element, "Name"):
        type_name = element.Name

    parameters = {}
    for param in element.Parameters:
        if not param.HasValue or param.IsReadOnly:
            continue
        definition = param.Definition
        if definition is None:
            continue
        param_name = definition.Name
        value = _param_value(param)
        if value is not None and value != "":
            parameters[param_name] = value

    volume = _builtin_double(
        element,
        "HOST_VOLUME_COMPUTED",
        "VOLUME",
    )
    area = _builtin_double(element, "HOST_AREA_COMPUTED")
    length = _builtin_double(element, "CURVE_ELEM_LENGTH")

    return {
        "element_id": element_id,
        "category": category_name,
        "family": family_name,
        "type_name": type_name,
        "level": level_name,
        "parameters": parameters,
        "volume": volume,
        "area": area,
        "length": length,
    }


def _param_value(param):
    storage_type = param.StorageType
    if storage_type == StorageType.String:
        return param.AsString()
    if storage_type == StorageType.Integer:
        return param.AsInteger()
    if storage_type == StorageType.Double:
        return param.AsDouble()
    if storage_type == StorageType.ElementId:
        eid = param.AsElementId()
        if eid is None:
            return None
        return str(_element_id_int(eid))
    return None


def _builtin_double(element, *built_in_names):
    """Read a double parameter by BuiltInParameter NAME (safe across Revit versions)."""
    for name in built_in_names:
        built_in = getattr(BuiltInParameter, name, None)
        if built_in is None:
            continue
        try:
            param = element.get_Parameter(built_in)
        except Exception:
            continue
        if param is not None and param.HasValue:
            try:
                return param.AsDouble()
            except Exception:
                continue
    return None
