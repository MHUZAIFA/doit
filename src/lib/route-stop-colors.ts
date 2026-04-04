/** Distinct hex colors for route stops (map pins + suggested-route numbers). Cycles if there are more stops than colors. */
export const ROUTE_STOP_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#4f46e5",
  "#0d9488",
] as const

export function routeStopColorHex(routeIndex: number): string {
  const i = Math.floor(routeIndex)
  if (i < 0) return ROUTE_STOP_COLORS[0]
  return ROUTE_STOP_COLORS[i % ROUTE_STOP_COLORS.length]!
}
