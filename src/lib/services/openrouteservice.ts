export type LngLat = [number, number]

/** Crow‑flies distance in meters (WGS84). */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6_371_000
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * When ORS matrix is unavailable, approximate durations (seconds) from straight-line
 * distance and a constant speed so greedy ordering still works.
 */
export function haversineDurationMatrix(
  locationsLngLat: LngLat[],
  speedKmh = 35
): number[][] {
  const n = locationsLngLat.length
  const speedMps = speedKmh / 3.6
  const m: number[][] = []
  for (let i = 0; i < n; i++) {
    m[i] = []
    for (let j = 0; j < n; j++) {
      if (i === j) {
        m[i][j] = 0
      } else {
        const meters = haversineMeters(locationsLngLat[i]!, locationsLngLat[j]!)
        m[i][j] = meters / speedMps
      }
    }
  }
  return m
}

function authorizationHeader(): string | null {
  const k = process.env.OPENROUTESERVICE_API_KEY?.trim()
  if (!k) return null
  // Public ORS API expects: Authorization: Bearer <key>
  return /^Bearer\s+/i.test(k) ? k : `Bearer ${k}`
}

/** durations[i][j] in seconds */
export async function orsMatrix(
  locationsLngLat: LngLat[],
  profile: "driving-car" | "foot-walking" = "driving-car"
): Promise<number[][] | null> {
  const auth = authorizationHeader()
  if (!auth || locationsLngLat.length < 1) return null

  const res = await fetch(`https://api.openrouteservice.org/v2/matrix/${profile}`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locations: locationsLngLat,
      metrics: ["duration"],
      units: "seconds",
    }),
    cache: "no-store",
  })

  let data: { durations?: number[][] | null; error?: { code?: number; message?: string } }
  try {
    data = (await res.json()) as typeof data
  } catch {
    return null
  }

  if (!res.ok) {
    if (process.env.NODE_ENV === "development") {
      const msg = data.error?.message ?? res.statusText
      console.warn("[ORS matrix]", res.status, msg)
    }
    return null
  }

  if (data.error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ORS matrix]", data.error)
    }
    return null
  }

  const d = data.durations
  if (!d || !Array.isArray(d)) return null
  return d
}

function extractLineStringCoords(geometry: {
  type?: string
  coordinates?: unknown
}): number[][] | null {
  const { type, coordinates: c } = geometry
  if (!c) return null
  if (type === "LineString" && Array.isArray(c) && c.length > 0) {
    const first = c[0] as unknown
    if (Array.isArray(first) && typeof first[0] === "number") {
      return c as number[][]
    }
  }
  if (type === "MultiLineString" && Array.isArray(c)) {
    const lines = c as number[][][]
    const flat: number[][] = []
    for (const seg of lines) {
      if (Array.isArray(seg)) flat.push(...seg)
    }
    return flat.length ? flat : null
  }
  return null
}

/**
 * ORS GeoJSON FeatureCollection: take the first feature with a line geometry.
 */
function coordsFromDirectionsGeoJson(data: unknown): number[][] | null {
  const fc = data as {
    features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }>
  }
  for (const f of fc.features ?? []) {
    const g = f.geometry
    if (!g) continue
    const coords = extractLineStringCoords(g)
    if (coords?.length) return coords
  }
  return null
}

/** Waypoints [lng,lat] → Leaflet [lat,lng] polyline positions. */
export function lngLatWaypointsToLeaflet(waypoints: LngLat[]): [number, number][] {
  return waypoints.map(([lng, lat]) => [lat, lng] as [number, number])
}

export async function orsDirectionsLineString(
  coordinatesLngLat: LngLat[],
  profile: "driving-car" | "foot-walking" = "driving-car"
): Promise<number[][] | null> {
  const auth = authorizationHeader()
  if (!auth || coordinatesLngLat.length < 2) return null

  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coordinates: coordinatesLngLat }),
    cache: "no-store",
  })

  let data: unknown
  try {
    data = await res.json()
  } catch {
    return null
  }

  if (!res.ok) {
    const err = data as { error?: { message?: string } }
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[ORS directions]",
        res.status,
        err.error?.message ?? res.statusText,
        JSON.stringify(data).slice(0, 400)
      )
    }
    return null
  }

  const coords = coordsFromDirectionsGeoJson(data)
  if (!coords?.length) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ORS directions] no LineString coordinates in response")
    }
    return null
  }
  return coords
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
