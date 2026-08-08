/** App-wide URLs and labels (no secrets). */

export const APP_NAME = "BIM Dashboard";

export const API_ENDPOINTS = {
  elements: "/api/elements",
  elementsMap: "/api/elements/map",
  elementCategories: "/api/elements/categories",
  elementLevels: "/api/elements/levels",
  elementCompleteness: "/api/elements/completeness",
  kpis: "/api/kpis",
  authMe: "/api/auth/me",
  authToken: "/api/auth/token",
  speckleViewerConfig: "/api/speckle/viewer-config",
  chat: "/api/chat",
} as const;

export const WS_DASHBOARD_PATH = "/ws/dashboard";
