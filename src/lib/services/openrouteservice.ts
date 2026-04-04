export type LngLat = [number, number]

function key(): string | null {
  const k = process.env.OPENROUTESERVICE_API_KEY?.trim()
  return k || null
}

/** durations[i][j] in seconds */
export async function orsMatrix(
  locationsLngLat: LngLat[],
  profile: "driving-car" | "foot-walking" = "driving-car"
): Promise<number[][] | null> {
  const apiKey = key()
  if (!apiKey || locationsLngLat.length < 1) return null

  const res = await fetch(`https://api.openrouteservice.org/v2/matrix/${profile}`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locations: locationsLngLat,
      metrics: ["duration"],
      units: "seconds",
    }),
    next: { revalidate: 0 },
  })

  if (!res.ok) return null
  const data = (await res.json()) as { durations?: number[][] }
  return data.durations ?? null
}

export async function orsDirectionsLineString(
  coordinatesLngLat: LngLat[],
  profile: "driving-car" | "foot-walking" = "driving-car"
): Promise<number[][] | null> {
  const apiKey = key()
  if (!apiKey || coordinatesLngLat.length < 2) return null

  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coordinates: coordinatesLngLat }),
    next: { revalidate: 0 },
  })

  if (!res.ok) return null
  const data = (await res.json()) as {
    features?: Array<{ geometry?: { type?: string; coordinates?: number[][] } }>
  }
  const coords = data.features?.[0]?.geometry?.coordinates
  if (!coords || !Array.isArray(coords)) return null
  return coords as number[][]
}

/** Greedy order by matrix durations from startIndex */
export function greedyDurationOrder(matrix: number[][], startIndex = 0): number[] {
  const n = matrix.length
  if (n === 0) return []
  const unvisited = new Set<number>()
  for (let i = 0; i < n; i++) unvisited.add(i)
  const order: number[] = []
  let current = startIndex
  if (!unvisited.has(current)) current = 0
  unvisited.delete(current)
  order.push(current)
  while (unvisited.size > 0) {
    let best = -1
    let bestT = Infinity
    for (const j of unvisited) {
      const t = matrix[current]?.[j]
      if (typeof t === "number" && t >= 0 && t < bestT) {
        bestT = t
        best = j
      }
    }
    if (best < 0) {
      best = unvisited.values().next().value as number
    }
    order.push(best)
    unvisited.delete(best)
    current = best
  }
  return order
}
