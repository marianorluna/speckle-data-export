/** App-wide URLs and labels (no secrets). */

export const APP_NAME = "BIM Dashboard";

export const API_ENDPOINTS = {
  elements: "/api/elements",
  kpis: "/api/kpis",
  authMe: "/api/auth/me",
  authToken: "/api/auth/token",
} as const;

export const WS_DASHBOARD_PATH = "/ws/dashboard";
