/** Tailwind-aligned hex palette for Recharts (no Cell / CSS class fills). */
export const CHART_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#f43f5e", // rose-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
] as const;

export function chartColorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]!;
}
