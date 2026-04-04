import { NextResponse } from "next/server"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { autocompletePredictions } from "@/lib/services/maps"

export async function GET(request: Request) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") ?? ""
  const sessionToken = searchParams.get("sessionToken") ?? undefined

  const predictions = await autocompletePredictions(q, sessionToken)
  return NextResponse.json({ predictions })
}
