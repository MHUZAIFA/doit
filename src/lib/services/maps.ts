export type LatLng = { lat: number; lng: number }

export type PlaceSuggestion = {
  placeId: string
  description: string
}

export type ResolvedPlace = {
  lat: number
  lng: number
  displayName: string
}

export type NearbyPlace = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
}

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

export async function reverseGeocodeFormatted(lat: number, lng: number): Promise<string | null> {
  const key = apiKey()
  if (!key) return null
  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key,
  })
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`)
  if (!res.ok) return null
  const data = (await res.json()) as { results?: Array<{ formatted_address?: string }> }
  return data.results?.[0]?.formatted_address ?? null
}

export async function autocompletePredictions(
  input: string,
  sessionToken?: string
): Promise<PlaceSuggestion[]> {
  const key = apiKey()
  const q = input.trim()
  if (!key || q.length < 2) return []
  const params = new URLSearchParams({
    input: q,
    key,
  })
  if (sessionToken) params.set("sessiontoken", sessionToken)
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
  )
  if (!res.ok) return []
  const data = (await res.json()) as {
    predictions?: Array<{ place_id?: string; description?: string }>
  }
  return (data.predictions ?? [])
    .filter((p) => p.place_id && p.description)
    .slice(0, 8)
    .map((p) => ({ placeId: p.place_id!, description: p.description! }))
}

export async function resolvePlaceId(placeId: string): Promise<ResolvedPlace | null> {
  const key = apiKey()
  if (!key || !placeId) return null
  const params = new URLSearchParams({
    place_id: placeId,
    key,
  })
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`)
  if (!res.ok) return null
  const data = (await res.json()) as {
    results?: Array<{ formatted_address?: string; geometry?: { location?: LatLng } }>
  }
  const r = data.results?.[0]
  const loc = r?.geometry?.location
  if (!r?.formatted_address || !loc || typeof loc.lat !== "number") return null
  return { lat: loc.lat, lng: loc.lng, displayName: r.formatted_address }
}

export async function nearbyPlacesWithCoords(
  location: LatLng,
  radiusMeters = 1200
): Promise<NearbyPlace[]> {
  const key = apiKey()
  if (!key) return []
  const params = new URLSearchParams({
    location: `${location.lat},${location.lng}`,
    radius: String(radiusMeters),
    type: "establishment",
    key,
  })
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`
  )
  if (!res.ok) return []
  const data = (await res.json()) as {
    results?: Array<{
      place_id?: string
      name?: string
      vicinity?: string
      geometry?: { location?: LatLng }
    }>
  }
  const out: NearbyPlace[] = []
  for (const r of data.results ?? []) {
    const loc = r.geometry?.location
    if (!r.place_id || !r.name || !loc || typeof loc.lat !== "number") continue
    out.push({
      placeId: r.place_id,
      name: r.name,
      address: r.vicinity ?? "",
      lat: loc.lat,
      lng: loc.lng,
    })
    if (out.length >= 10) break
  }
  return out
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
