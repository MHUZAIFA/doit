import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { ScheduleDocument } from "@/lib/models"
import { scheduleTaskIdToString } from "@/lib/schedule-task-id"

export async function GET(request: Request) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Query ?date=YYYY-MM-DD required" }, { status: 400 })
  }

  const db = await getDb()
  const doc = await db.collection<ScheduleDocument>(COLLECTIONS.schedules).findOne({
    userId: auth.userId,
    date,
  })

  if (!doc) {
    return NextResponse.json({ schedule: null })
  }

  const scheduleOptions = doc.scheduleOptions.map((opt) => ({
    ...opt,
    tasks: opt.tasks.map((slot) => {
      const raw = slot.taskId as unknown
      const taskId = raw instanceof ObjectId ? raw.toString() : scheduleTaskIdToString(raw)
      return { ...slot, taskId }
    }),
  }))

  return NextResponse.json({
    schedule: {
      id: doc._id.toString(),
      date: doc.date,
      scheduleOptions,
      alerts: doc.alerts,
      aiSummary: doc.aiSummary ?? null,
      updatedAt: doc.updatedAt.toISOString(),
    },
  })
}
