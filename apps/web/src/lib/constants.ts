/** App-wide URLs and labels (no secrets). */

export const APP_NAME = "BIM Dashboard";

export const API_ENDPOINTS = {
  elements: "/api/elements",
  elementCategories: "/api/elements/categories",
  elementLevels: "/api/elements/levels",
  kpis: "/api/kpis",
  authMe: "/api/auth/me",
  authToken: "/api/auth/token",
} as const;

export const WS_DASHBOARD_PATH = "/ws/dashboard";
