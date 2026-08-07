import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../lib/api";
import { API_ENDPOINTS } from "../lib/constants";

export type SpeckleViewerConfig = {
  server_url: string;
  stream_id: string;
  token: string;
  branch_name: string;
  commit_id: string | null;
};

type ViewerConfigResponse = {
  success: boolean;
  data: SpeckleViewerConfig;
};

/** Speckle connection for the viewer (JWT-gated; PAT not in Vite env). */
export function useViewerConfig() {
  return useQuery({
    queryKey: ["speckle", "viewer-config"],
    queryFn: async () => {
      const response = await apiRequest<ViewerConfigResponse>(
        API_ENDPOINTS.speckleViewerConfig,
      );
      return response.data;
    },
    staleTime: Infinity,
  });
}
