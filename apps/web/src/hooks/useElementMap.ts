import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../lib/api";
import { API_ENDPOINTS } from "../lib/constants";

type ElementMapResponse = {
  success: boolean;
  data: Record<string, string>;
};

/** ``element_id`` → Speckle ``applicationId`` (identity map today). */
export function useElementMap() {
  return useQuery({
    queryKey: ["elements", "map"],
    queryFn: async () => {
      const response = await apiRequest<ElementMapResponse>(
        API_ENDPOINTS.elementsMap,
      );
      return response.data;
    },
    staleTime: 60_000,
  });
}
