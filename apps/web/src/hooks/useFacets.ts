import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../lib/api";
import { API_ENDPOINTS } from "../lib/constants";
import {
  categoryFacetParams,
  completenessFacetParams,
  facetParamsToSearch,
  levelFacetParams,
  type CompletenessBucket,
  type FacetQueryParams,
  type OverviewCrossFilter,
} from "./useOverviewCrossFilter";

export type CategoryCount = {
  category: string;
  count: number;
};

export type LevelCount = {
  level: string | null;
  count: number;
};

export type CompletenessCounts = {
  missing_level: number;
  missing_fire: number;
  complete: number;
};

type FacetListResponse<T> = {
  success: boolean;
  data: T[];
};

type FacetDataResponse<T> = {
  success: boolean;
  data: T;
};

function buildUrl(endpoint: string, params: FacetQueryParams): string {
  return `${endpoint}${facetParamsToSearch(params)}`;
}

export function useCategories(filters: OverviewCrossFilter = {}) {
  const params = categoryFacetParams(filters);
  return useQuery({
    queryKey: ["categories", params],
    queryFn: async () => {
      const response = await apiRequest<FacetListResponse<CategoryCount>>(
        buildUrl(API_ENDPOINTS.elementCategories, params),
      );
      return response.data;
    },
  });
}

export function useLevels(filters: OverviewCrossFilter = {}) {
  const params = levelFacetParams(filters);
  return useQuery({
    queryKey: ["levels", params],
    queryFn: async () => {
      const response = await apiRequest<FacetListResponse<LevelCount>>(
        buildUrl(API_ENDPOINTS.elementLevels, params),
      );
      return response.data;
    },
  });
}

export function useCompleteness(filters: OverviewCrossFilter = {}) {
  const params = completenessFacetParams(filters);
  return useQuery({
    queryKey: ["completeness", params],
    queryFn: async () => {
      const response = await apiRequest<FacetDataResponse<CompletenessCounts>>(
        buildUrl(API_ENDPOINTS.elementCompleteness, params),
      );
      return response.data;
    },
  });
}

export type { CompletenessBucket, OverviewCrossFilter };
