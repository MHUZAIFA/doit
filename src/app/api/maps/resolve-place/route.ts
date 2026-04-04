import { NextResponse } from "next/server"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { resolvePlaceId } from "@/lib/services/maps"

export async function GET(request: Request) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get("placeId") ?? ""
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 })
  }

  const resolved = await resolvePlaceId(placeId)
  if (!resolved) {
    return NextResponse.json({ error: "Could not resolve place" }, { status: 404 })
  }
  return NextResponse.json(resolved)
}
