import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../lib/api";
import { API_ENDPOINTS } from "../lib/constants";

export type CategoryCount = {
  category: string;
  count: number;
};

export type LevelCount = {
  level: string | null;
  count: number;
};

type FacetListResponse<T> = {
  success: boolean;
  data: T[];
};

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiRequest<FacetListResponse<CategoryCount>>(
        API_ENDPOINTS.elementCategories,
      );
      return response.data;
    },
  });
}

export function useLevels() {
  return useQuery({
    queryKey: ["levels"],
    queryFn: async () => {
      const response = await apiRequest<FacetListResponse<LevelCount>>(
        API_ENDPOINTS.elementLevels,
      );
      return response.data;
    },
  });
}
