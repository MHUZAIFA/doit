/** https://operations.osmfoundation.org/policies/nominatim/ — identify app; max ~1 req/s */

function userAgent(): string {
  return (
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    "DoneTaskApp/1.0 (https://github.com/local; routing@local)"
  )
}

export type NominatimResult = {
  lat: number
  lon: number
  displayName: string
  osmType: "node" | "way" | "relation" | null
  osmId: number | null
  raw: Record<string, unknown>
}

function mapHit(r: Record<string, unknown>): NominatimResult | null {
  const lat = parseFloat(String(r.lat ?? ""))
  const lon = parseFloat(String(r.lon ?? ""))
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  const osmTypeRaw = String(r.osm_type ?? "")
  const osmType =
    osmTypeRaw === "node" || osmTypeRaw === "way" || osmTypeRaw === "relation"
      ? osmTypeRaw
      : null
  const osmIdRaw = r.osm_id
  const osmId =
    typeof osmIdRaw === "number"
      ? osmIdRaw
      : typeof osmIdRaw === "string"
        ? parseInt(osmIdRaw, 10)
        : null
  return {
    lat,
    lon,
    displayName: String(r.display_name ?? "Unknown place"),
    osmType,
    osmId: Number.isFinite(osmId as number) ? (osmId as number) : null,
    raw: r,
  }
}

export async function nominatimSearch(query: string, limit = 6): Promise<NominatimResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: String(Math.min(limit, 10)),
    addressdetails: "1",
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": userAgent(),
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) return []
  const data = (await res.json()) as Record<string, unknown>[]
  if (!Array.isArray(data)) return []
  return data.map((r) => mapHit(r)).filter((x): x is NominatimResult => x !== null)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function nominatimReverse(lat: number, lon: number): Promise<NominatimResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      "User-Agent": userAgent(),
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) return null
  const data = (await res.json()) as Record<string, unknown>
  return mapHit(data)
}
