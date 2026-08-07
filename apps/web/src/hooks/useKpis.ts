import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../lib/api";
import { API_ENDPOINTS } from "../lib/constants";

export type KpiData = {
  total_elements: number;
  elements_by_category: Record<string, number>;
  elements_by_level: Record<string, number>;
  missing_fire_rating: number;
  missing_level: number;
  total_volume_m3: number;
  total_area_m2: number;
  last_updated: string | null;
  last_commit_id: string | null;
};

type KpisResponse = {
  success: boolean;
  data: KpiData;
};

export function useKpis() {
  return useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const response = await apiRequest<KpisResponse>(API_ENDPOINTS.kpis);
      return response.data;
    },
    refetchInterval: 30_000,
  });
}
