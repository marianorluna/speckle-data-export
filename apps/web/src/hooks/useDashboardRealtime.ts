import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useWebSocket } from "./useWebSocket";

const DASHBOARD_QUERY_KEYS = [
  ["kpis"],
  ["elements"],
  ["categories"],
  ["levels"],
] as const;

/**
 * Single WS subscription point for the dashboard: invalidate Query caches
 * on live BIM updates (avoids per-widget subscribe duplication).
 */
export function useDashboardRealtime() {
  const queryClient = useQueryClient();
  const { connected, subscribe } = useWebSocket();

  useEffect(() => {
    const invalidateDashboard = () => {
      for (const queryKey of DASHBOARD_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    };

    const unsubElement = subscribe("element_updated", invalidateDashboard);
    const unsubCommit = subscribe("commit_processed", () => {
      void queryClient.invalidateQueries();
    });

    return () => {
      unsubElement();
      unsubCommit();
    };
  }, [subscribe, queryClient]);

  return { connected };
}
