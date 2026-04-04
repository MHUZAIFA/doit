import { NextResponse } from "next/server"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { nominatimSearch } from "@/lib/services/nominatim"

export async function GET(request: Request) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const q = new URL(request.url).searchParams.get("q") ?? ""
  const results = await nominatimSearch(q, 8)
  return NextResponse.json({
    results: results.map((r) => ({
      displayName: r.displayName,
      lat: r.lat,
      lon: r.lon,
      osmType: r.osmType,
      osmId: r.osmId,
    })),
  })
}
