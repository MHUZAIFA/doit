import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { ScheduleDocument, TaskDocument, UserDocument } from "@/lib/models"
import { buildScheduleOptions } from "@/lib/services/scheduling"
import { buildTaskTravelMatrix } from "@/lib/travel-matrix"
import { fetchWeatherForCoords } from "@/lib/services/weather"
import { summarizeSchedulingContext } from "@/lib/services/ai"

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { date } = parsed.data
  const db = await getDb()

  const user = await db.collection<UserDocument>(COLLECTIONS.users).findOne({
    _id: auth.userId,
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const tasks = await db
    .collection<TaskDocument>(COLLECTIONS.tasks)
    .find({ userId: auth.userId })
    .toArray()

  const travelMatrix = await buildTaskTravelMatrix(tasks)

  let weather = null as Awaited<ReturnType<typeof fetchWeatherForCoords>>
  const withCoords = tasks.find((t) => t.location.coordinates)
  if (withCoords?.location.coordinates) {
    weather = await fetchWeatherForCoords(
      withCoords.location.coordinates.lat,
      withCoords.location.coordinates.lng
    )
  }

  const { options, alerts } = buildScheduleOptions(
    tasks,
    date,
    {
      businessHoursStart: user.preferences.businessHoursStart,
      businessHoursEnd: user.preferences.businessHoursEnd,
    },
    travelMatrix,
    weather
  )

  const now = new Date()
  const scheduleDoc: Omit<ScheduleDocument, "_id"> = {
    userId: auth.userId,
    date,
    scheduleOptions: options,
    alerts,
    createdAt: now,
    updatedAt: now,
  }

  await db.collection<ScheduleDocument>(COLLECTIONS.schedules).deleteMany({
    userId: auth.userId,
    date,
  })

  const { insertedId } = await db
    .collection<ScheduleDocument>(COLLECTIONS.schedules)
    .insertOne(scheduleDoc as ScheduleDocument)

  let aiSummary: string | null = null
  if (!user.preferences.privacyMode) {
    const taskTitles = tasks.slice(0, 12).map((t) => t.title).join(", ")
    aiSummary = await summarizeSchedulingContext(
      `Today is ${date}. Tasks: ${taskTitles || "(none)"}. Weather: ${weather?.description ?? "n/a"}. Scheduling produced ${options.length} options. Summarize tradeoffs briefly.`
    )
  }

  if (options.length === 0 && alerts.length > 0) {
    await db.collection(COLLECTIONS.notifications).insertOne({
      userId: auth.userId,
      type: "schedule",
      title: "Scheduling alert",
      body: alerts[0] ?? "Could not build a schedule.",
      read: false,
      createdAt: new Date(),
    })
  }

  return NextResponse.json({
    schedule: {
      id: insertedId.toString(),
      date,
      scheduleOptions: options,
      alerts,
      aiSummary,
    },
  })
}
