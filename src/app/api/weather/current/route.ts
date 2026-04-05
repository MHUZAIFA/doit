import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { fetchWeatherForCoords } from "@/lib/services/weather"

export async function GET(request: Request) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const latParsed = z.coerce.number().min(-90).max(90).safeParse(searchParams.get("lat"))
  const lonParsed = z.coerce.number().min(-180).max(180).safeParse(searchParams.get("lon"))
  if (!latParsed.success || !lonParsed.success) {
    return NextResponse.json({ error: "lat and lon query params are required" }, { status: 400 })
  }

  const weather = await fetchWeatherForCoords(latParsed.data, lonParsed.data)
  if (!weather) {
    return NextResponse.json(
      { error: "Weather unavailable. Check OPENWEATHER_API_KEY on the server." },
      { status: 503 }
    )
  }

  return NextResponse.json(weather)
}
