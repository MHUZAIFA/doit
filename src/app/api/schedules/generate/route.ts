import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import { defaultPreferences, type ScheduleDocument, type TaskDocument, type UserDocument } from "@/lib/models"
import { buildScheduleOptions } from "@/lib/services/scheduling"
import { buildTaskTravelMatrix } from "@/lib/travel-matrix"
import { fetchWeatherForCoords } from "@/lib/services/weather"
import { summarizeSchedulingContext } from "@/lib/services/ai"
import { scheduleTaskIdToString } from "@/lib/schedule-task-id"

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** When true and `clientCalendarDate` matches `date`, schedule from now + 15 minutes (client’s “today”). */
  fromNow: z.boolean().optional(),
  /** Browser local calendar date when the user clicked generate; must match `date` to apply `fromNow`. */
  clientCalendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Browser IANA zone for this request (e.g. America/Toronto); overrides stored prefs for day boundaries. */
  clientTimeZone: z.string().min(1).max(64).optional(),
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

  const { date, fromNow, clientCalendarDate, clientTimeZone } = parsed.data
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

  const pref = { ...defaultPreferences(), ...user.preferences }
  const tz =
    clientTimeZone?.trim() || pref.timezone?.trim() || "UTC"
  let anchorStartMs: number | null = null
  if (fromNow === true && clientCalendarDate != null && clientCalendarDate === date) {
    anchorStartMs = Date.now() + 15 * 60 * 1000
  }

  const { options, alerts } = buildScheduleOptions(
    tasks,
    date,
    {
      businessHoursStart: pref.businessHoursStart,
      businessHoursEnd: pref.businessHoursEnd,
      sleepHoursEnabled: pref.sleepHoursEnabled,
      sleepHoursStart: pref.sleepHoursStart,
      sleepHoursEnd: pref.sleepHoursEnd,
      timeZone: tz,
    },
    travelMatrix,
    weather,
    { anchorStartMs }
  )

  let aiSummary: string | null = null
  if (!user.preferences.privacyMode) {
    const taskTitles = tasks.slice(0, 12).map((t) => t.title).join(", ")
    const wx =
      weather != null
        ? `${weather.description}, ${Math.round(weather.tempC)}°C (feels like ${Math.round(weather.feelsLikeC)}°C)`
        : "n/a"
    aiSummary = await summarizeSchedulingContext(
      `Today is ${date}. Tasks: ${taskTitles || "(none)"}. Weather: ${wx}. Scheduling produced ${options.length} options.`,
      { brief: true }
    )
  }

  const now = new Date()
  const scheduleDoc: Omit<ScheduleDocument, "_id"> = {
    userId: auth.userId,
    date,
    scheduleOptions: options,
    alerts,
    aiSummary,
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

  const scheduleOptions = options.map((opt) => ({
    ...opt,
    tasks: opt.tasks.map((slot) => ({
      ...slot,
      taskId: scheduleTaskIdToString(slot.taskId as unknown),
    })),
  }))

  return NextResponse.json({
    schedule: {
      id: insertedId.toString(),
      date,
      scheduleOptions,
      alerts,
      aiSummary,
    },
  })
}
