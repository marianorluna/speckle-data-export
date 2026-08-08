/** Shared cross-filter state for Resumen charts (Power BI-style). */

export type CompletenessBucket = "missing_level" | "missing_fire" | "complete";

export type OverviewCrossFilter = {
  category?: string;
  /** Named level, or ``null`` for «Sin nivel». */
  level?: string | null;
  completeness?: CompletenessBucket;
};

export function hasActiveOverviewFilter(filters: OverviewCrossFilter): boolean {
  return (
    filters.category !== undefined ||
    filters.level !== undefined ||
    filters.completeness !== undefined
  );
}

export function toggleCategoryFilter(
  prev: OverviewCrossFilter,
  category: string,
): OverviewCrossFilter {
  const next = { ...prev };
  if (prev.category === category) {
    delete next.category;
  } else {
    next.category = category;
  }
  return next;
}

export function toggleLevelFilter(
  prev: OverviewCrossFilter,
  level: string | null,
): OverviewCrossFilter {
  const next = { ...prev };
  const same =
    prev.level !== undefined &&
    ((level === null && prev.level === null) || prev.level === level);
  if (same) {
    delete next.level;
  } else {
    next.level = level;
  }
  return next;
}

export function toggleCompletenessFilter(
  prev: OverviewCrossFilter,
  bucket: CompletenessBucket,
): OverviewCrossFilter {
  const next = { ...prev };
  if (prev.completeness === bucket) {
    delete next.completeness;
  } else {
    next.completeness = bucket;
  }
  return next;
}

/** Query params for facets (omit the chart's own dimension). */
export type FacetQueryParams = {
  category?: string;
  level?: string;
  missing_level?: boolean;
  completeness?: CompletenessBucket;
};

/** Category chart: apply level + completeness (keep full category breakdown). */
export function categoryFacetParams(
  filters: OverviewCrossFilter,
): FacetQueryParams {
  const params: FacetQueryParams = {};
  if (filters.level === null) {
    params.missing_level = true;
  } else if (filters.level !== undefined) {
    params.level = filters.level;
  }
  if (filters.completeness !== undefined) {
    params.completeness = filters.completeness;
  }
  return params;
}

/** Level charts: apply category + completeness. */
export function levelFacetParams(
  filters: OverviewCrossFilter,
): FacetQueryParams {
  const params: FacetQueryParams = {};
  if (filters.category !== undefined) {
    params.category = filters.category;
  }
  if (filters.completeness !== undefined) {
    params.completeness = filters.completeness;
  }
  return params;
}

/** Completeness chart: apply category + level. */
export function completenessFacetParams(
  filters: OverviewCrossFilter,
): FacetQueryParams {
  const params: FacetQueryParams = {};
  if (filters.category !== undefined) {
    params.category = filters.category;
  }
  if (filters.level === null) {
    params.missing_level = true;
  } else if (filters.level !== undefined) {
    params.level = filters.level;
  }
  return params;
}

export function facetParamsToSearch(params: FacetQueryParams): string {
  const search = new URLSearchParams();
  if (params.category !== undefined) {
    search.set("category", params.category);
  }
  if (params.level !== undefined) {
    search.set("level", params.level);
  }
  if (params.missing_level === true) {
    search.set("missing_level", "true");
  }
  if (params.completeness !== undefined) {
    search.set("completeness", params.completeness);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
