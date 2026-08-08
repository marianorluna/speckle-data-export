"""REST routes: BIM elements list, detail, map, categories, and levels."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import SessionDep
from src.api.schemas import (
    ApiDataResponse,
    ApiListResponse,
    CategoryCountOut,
    CompletenessOut,
    ElementOut,
    LevelCountOut,
)
from src.infrastructure.db.element_repository import ElementRepository

router = APIRouter()

CompletenessFilter = Literal["missing_level", "missing_fire", "complete"]


@router.get("", response_model=ApiListResponse[ElementOut])
async def list_elements(
    session: SessionDep,
    category: Annotated[str | None, Query()] = None,
    level: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    missing_param: Annotated[str | None, Query()] = None,
    missing_level: Annotated[bool, Query()] = False,
    completeness: Annotated[CompletenessFilter | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
) -> ApiListResponse[ElementOut]:
    """List elements with optional filters and pagination."""
    repo = ElementRepository(session)
    try:
        rows, total = await repo.list_elements(
            category=category,
            level=level,
            search=search,
            missing_param=missing_param,
            missing_level=missing_level,
            completeness=completeness,
            skip=skip,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return ApiListResponse(
        data=[ElementOut.model_validate(row) for row in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/map", response_model=ApiDataResponse[dict[str, str]])
async def get_element_map(session: SessionDep) -> ApiDataResponse[dict[str, str]]:
    """Map Revit ``element_id`` (UniqueId) → Speckle ``applicationId``.

    Values match keys today: we select in the viewer by ``applicationId``, which
    is the stable UniqueId stored as ``bim_elements.element_id``.
    """
    repo = ElementRepository(session)
    mapping = await repo.element_application_id_map()
    return ApiDataResponse(data=mapping)


@router.get("/categories", response_model=ApiDataResponse[list[CategoryCountOut]])
async def list_categories(
    session: SessionDep,
    level: Annotated[str | None, Query()] = None,
    missing_level: Annotated[bool, Query()] = False,
    completeness: Annotated[CompletenessFilter | None, Query()] = None,
) -> ApiDataResponse[list[CategoryCountOut]]:
    """Unique categories with element counts (optional cross-filters)."""
    repo = ElementRepository(session)
    try:
        pairs = await repo.count_by_category(
            level=level,
            missing_level=missing_level,
            completeness=completeness,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return ApiDataResponse(
        data=[CategoryCountOut(category=cat, count=count) for cat, count in pairs],
    )


@router.get("/levels", response_model=ApiDataResponse[list[LevelCountOut]])
async def list_levels(
    session: SessionDep,
    category: Annotated[str | None, Query()] = None,
    completeness: Annotated[CompletenessFilter | None, Query()] = None,
) -> ApiDataResponse[list[LevelCountOut]]:
    """Unique levels with element counts (optional cross-filters)."""
    repo = ElementRepository(session)
    try:
        pairs = await repo.count_by_level(
            category=category,
            completeness=completeness,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return ApiDataResponse(
        data=[LevelCountOut(level=lvl, count=count) for lvl, count in pairs],
    )


@router.get("/completeness", response_model=ApiDataResponse[CompletenessOut])
async def get_completeness(
    session: SessionDep,
    category: Annotated[str | None, Query()] = None,
    level: Annotated[str | None, Query()] = None,
    missing_level: Annotated[bool, Query()] = False,
) -> ApiDataResponse[CompletenessOut]:
    """Mutually exclusive QC buckets (optional category/level cross-filters)."""
    repo = ElementRepository(session)
    try:
        buckets = await repo.count_completeness_buckets(
            category=category,
            level=level,
            missing_level=missing_level,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return ApiDataResponse(data=CompletenessOut.model_validate(buckets))


@router.get("/{element_id}", response_model=ApiDataResponse[ElementOut])
async def get_element(
    element_id: str,
    session: SessionDep,
) -> ApiDataResponse[ElementOut]:
    """Fetch one element by Revit UniqueId (``element_id``)."""
    repo = ElementRepository(session)
    row = await repo.get_by_element_id(element_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Element not found: {element_id}",
        )
    return ApiDataResponse(data=ElementOut.model_validate(row))
