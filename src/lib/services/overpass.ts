/** Overpass API — https://wiki.openstreetmap.org/wiki/Overpass_API */

export type OverpassTags = Record<string, string>

export type OverpassElement = {
  type: string
  id: number
  tags?: OverpassTags
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
}

async function runOverpass(query: string): Promise<OverpassElement[]> {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    next: { revalidate: 0 },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { elements?: OverpassElement[] }
  return data.elements ?? []
}

/** Direct OSM element by id */
export async function fetchElementTags(
  osmType: "node" | "way" | "relation",
  osmId: number
): Promise<OverpassTags | null> {
  const typeChar = osmType[0] // n, w, r
  const q =
    typeChar === "n"
      ? `[out:json][timeout:25];node(${osmId});out tags;`
      : typeChar === "w"
        ? `[out:json][timeout:25];way(${osmId});out center tags;`
        : `[out:json][timeout:25];relation(${osmId});out tags;`

  const els = await runOverpass(q)
  return els[0]?.tags ?? null
}

/** Find opening_hours near a point when we have no OSM id (e.g. interpolated Nominatim result) */
export async function fetchOpeningHoursNear(
  lat: number,
  lon: number,
  radiusM = 60
): Promise<string | null> {
  const q = `[out:json][timeout:25];
(
  node["opening_hours"](around:${radiusM},${lat},${lon});
  way["opening_hours"](around:${radiusM},${lat},${lon});
);
out tags center;
`
  const els = await runOverpass(q)
  for (const el of els) {
    const oh = el.tags?.opening_hours
    if (oh?.trim()) return oh.trim()
  }
  return null
}
