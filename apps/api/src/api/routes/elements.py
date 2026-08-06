"""REST routes: BIM elements list, detail, categories, and levels."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import SessionDep
from src.api.schemas import (
    ApiDataResponse,
    ApiListResponse,
    CategoryCountOut,
    ElementOut,
    LevelCountOut,
)
from src.infrastructure.db.element_repository import ElementRepository

router = APIRouter()


@router.get("", response_model=ApiListResponse[ElementOut])
async def list_elements(
    session: SessionDep,
    category: Annotated[str | None, Query()] = None,
    level: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    missing_param: Annotated[str | None, Query()] = None,
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


@router.get("/categories", response_model=ApiDataResponse[list[CategoryCountOut]])
async def list_categories(session: SessionDep) -> ApiDataResponse[list[CategoryCountOut]]:
    """Unique categories with element counts."""
    repo = ElementRepository(session)
    pairs = await repo.count_by_category()
    return ApiDataResponse(
        data=[CategoryCountOut(category=cat, count=count) for cat, count in pairs],
    )


@router.get("/levels", response_model=ApiDataResponse[list[LevelCountOut]])
async def list_levels(session: SessionDep) -> ApiDataResponse[list[LevelCountOut]]:
    """Unique levels with element counts."""
    repo = ElementRepository(session)
    pairs = await repo.count_by_level()
    return ApiDataResponse(
        data=[LevelCountOut(level=lvl, count=count) for lvl, count in pairs],
    )


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
