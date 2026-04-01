export type LatLng = { lat: number; lng: number }

export type DistanceMatrixResult = {
  origins: LatLng[]
  destinations: LatLng[]
  durationsMinutes: number[][]
}

const apiKey = () => process.env.GOOGLE_MAPS_API_KEY

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = apiKey()
  if (!key || !address.trim()) return null
  const params = new URLSearchParams({
    address,
    key,
  })
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    results?: Array<{ geometry?: { location?: LatLng } }>
  }
  const loc = data.results?.[0]?.geometry?.location
  if (!loc || typeof loc.lat !== "number") return null
  return { lat: loc.lat, lng: loc.lng }
}

export async function distanceMatrix(
  origins: LatLng[],
  destinations: LatLng[]
): Promise<DistanceMatrixResult | null> {
  const key = apiKey()
  if (!key || origins.length === 0 || destinations.length === 0) return null

  const fmt = (pts: LatLng[]) => pts.map((p) => `${p.lat},${p.lng}`).join("|")
  const params = new URLSearchParams({
    origins: fmt(origins),
    destinations: fmt(destinations),
    mode: "driving",
    key,
  })
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    rows?: Array<{
      elements?: Array<{ status: string; duration?: { value: number } }>
    }>
  }
  const rows = data.rows ?? []
  const durationsMinutes: number[][] = rows.map((row) =>
    (row.elements ?? []).map((el) =>
      el.status === "OK" && el.duration ? Math.ceil(el.duration.value / 60) : 30
    )
  )
  return { origins, destinations, durationsMinutes }
}

export async function directionsPolyline(
  waypoints: LatLng[]
): Promise<string | null> {
  const key = apiKey()
  if (!key || waypoints.length < 2) return null
  const origin = `${waypoints[0].lat},${waypoints[0].lng}`
  const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`
  const mid = waypoints.slice(1, -1)
  const params = new URLSearchParams({
    origin,
    destination,
    key,
  })
  if (mid.length > 0) {
    params.set("waypoints", mid.map((p) => `${p.lat},${p.lng}`).join("|"))
  }
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    routes?: Array<{ overview_polyline?: { points?: string } }>
  }
  return data.routes?.[0]?.overview_polyline?.points ?? null
}

export async function nearbyPlaces(
  location: LatLng,
  keyword: string,
  radiusMeters = 2000
): Promise<Array<{ name: string; address: string }>> {
  const key = apiKey()
  if (!key) return []
  const params = new URLSearchParams({
    location: `${location.lat},${location.lng}`,
    radius: String(radiusMeters),
    keyword,
    key,
  })
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`
  )
  if (!res.ok) return []
  const data = (await res.json()) as {
    results?: Array<{ name?: string; vicinity?: string }>
  }
  return (data.results ?? []).slice(0, 8).map((r) => ({
    name: r.name ?? "Place",
    address: r.vicinity ?? "",
  }))
}
