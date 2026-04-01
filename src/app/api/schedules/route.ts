import { NextResponse } from "next/server"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { ScheduleDocument } from "@/lib/models"

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

  return NextResponse.json({
    schedule: {
      id: doc._id.toString(),
      date: doc.date,
      scheduleOptions: doc.scheduleOptions,
      alerts: doc.alerts,
      updatedAt: doc.updatedAt.toISOString(),
    },
  })
}
