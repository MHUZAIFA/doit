import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { nearbyPlacesWithCoords, reverseGeocodeFormatted } from "@/lib/services/maps"

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
  }

  const { lat, lng } = parsed.data
  const [area, suggestions] = await Promise.all([
    reverseGeocodeFormatted(lat, lng),
    nearbyPlacesWithCoords({ lat, lng }),
  ])

  return NextResponse.json({
    area,
    latitude: lat,
    longitude: lng,
    suggestions,
  })
}
