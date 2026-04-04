import { NextResponse } from "next/server"
import { requireSessionUser } from "@/lib/api/auth-utils"

export async function GET() {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim()
  return NextResponse.json({
    places: Boolean(key),
  })
}
