import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../lib/api";
import { API_ENDPOINTS } from "../lib/constants";

export type ElementFilters = {
  category?: string;
  level?: string;
  search?: string;
  missing_param?: string;
  skip?: number;
  limit?: number;
};

export type BimElement = {
  id: number;
  element_id: string;
  category: string;
  family: string | null;
  type_name: string | null;
  level: string | null;
  parameters: Record<string, unknown>;
  volume: number | null;
  area: number | null;
  length: number | null;
  source: string;
  updated_at: string;
};

export type ElementsListResponse = {
  success: boolean;
  data: BimElement[];
  total: number;
  skip: number;
  limit: number;
};

function toQueryString(filters: ElementFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") {
      continue;
    }
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useElements(filters: ElementFilters = {}) {
  return useQuery({
    queryKey: ["elements", filters],
    queryFn: () =>
      apiRequest<ElementsListResponse>(
        `${API_ENDPOINTS.elements}${toQueryString(filters)}`,
      ),
  });
}
