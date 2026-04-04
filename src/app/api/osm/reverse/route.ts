import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { nominatimReverse } from "@/lib/services/nominatim"

const bodySchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
})

export async function POST(request: Request) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    json = {}
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { lat, lng } = parsed.data
  const hit = await nominatimReverse(lat, lng)
  if (!hit) {
    return NextResponse.json({ error: "Reverse geocode failed" }, { status: 502 })
  }

  return NextResponse.json({
    displayName: hit.displayName,
    lat: hit.lat,
    lon: hit.lon,
    osmType: hit.osmType,
    osmId: hit.osmId,
  })
}
