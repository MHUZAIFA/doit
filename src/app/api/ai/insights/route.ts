import { NextResponse } from "next/server"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { AiInsightsDocument, TaskDocument } from "@/lib/models"

export async function GET() {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const db = await getDb()
  let doc = await db.collection<AiInsightsDocument>(COLLECTIONS.aiInsights).findOne({
    userId: auth.userId,
  })

  if (!doc) {
    const tasks = await db
      .collection<TaskDocument>(COLLECTIONS.tasks)
      .find({ userId: auth.userId })
      .limit(50)
      .toArray()
    const cats = [...new Set(tasks.map((t) => t.category))]
    const pattern =
      tasks.length === 0
        ? "Add a few tasks to see productivity patterns."
        : `Most tasks cluster around: ${cats.slice(0, 4).join(", ") || "general"}.`
    const delays =
      tasks.filter((t) => t.priority === "high" && t.status === "pending").length > 2
        ? ["Several high-priority items still open — consider time-boxing."]
        : ["No major delay patterns detected."]

    const now = new Date()
    const insert = {
      userId: auth.userId,
      productivityPattern: pattern,
      commonDelays: delays,
      lastUpdated: now,
    }
    const { insertedId } = await db.collection(COLLECTIONS.aiInsights).insertOne(insert)
    doc = {
      _id: insertedId,
      ...insert,
    } as AiInsightsDocument
  }

  return NextResponse.json({
    insights: {
      productivityPattern: doc.productivityPattern,
      commonDelays: doc.commonDelays,
      lastUpdated: doc.lastUpdated.toISOString(),
    },
  })
}

export async function POST() {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const db = await getDb()
  const tasks = await db
    .collection<TaskDocument>(COLLECTIONS.tasks)
    .find({ userId: auth.userId })
    .limit(100)
    .toArray()

  const completed = tasks.filter((t) => t.status === "completed").length
  const pattern = `Completion ratio: ${completed}/${tasks.length || 1} tasks marked done.`
  const delays: string[] = []
  const late = tasks.filter((t) => t.deadline && t.deadline < new Date() && t.status !== "completed")
  if (late.length) delays.push(`${late.length} task(s) appear past deadline.`)

  const now = new Date()
  await db.collection(COLLECTIONS.aiInsights).updateOne(
    { userId: auth.userId },
    {
      $set: {
        productivityPattern: pattern,
        commonDelays: delays.length ? delays : ["Schedules look healthy."],
        lastUpdated: now,
      },
      $setOnInsert: { userId: auth.userId },
    },
    { upsert: true }
  )

  return NextResponse.json({ ok: true })
}
