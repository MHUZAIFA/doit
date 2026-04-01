import { NextResponse } from "next/server"
import { z } from "zod"
import { ObjectId } from "mongodb"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { TaskDocument, TaskPriority } from "@/lib/models"
import { encryptSensitiveText } from "@/lib/services/privacy"
import { serializeTask } from "@/lib/serialize"

const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  category: z.string().min(1).max(64).default("other"),
  location: z
    .object({
      name: z.string().max(500).default(""),
      coordinates: z
        .object({
          lat: z.number(),
          lng: z.number(),
        })
        .optional(),
    })
    .default({ name: "" }),
  durationMinutes: z.number().int().min(15).max(24 * 60),
  deadline: z.union([z.iso.datetime(), z.null()]).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  constraints: z.record(z.string(), z.any()).optional(),
})

export async function GET() {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const db = await getDb()
  const cursor = db
    .collection<TaskDocument>(COLLECTIONS.tasks)
    .find({ userId: auth.userId })
    .sort({ deadline: 1, createdAt: -1 })

  const docs = await cursor.toArray()
  return NextResponse.json({ tasks: docs.map((d) => serializeTask(d)) })
}

export async function POST(request: Request) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = await getDb()
  const user = await db.collection(COLLECTIONS.users).findOne({ _id: auth.userId })
  const privacyMode = Boolean(
    user && typeof user === "object" && "preferences" in user &&
      (user as { preferences?: { privacyMode?: boolean } }).preferences?.privacyMode
  )

  const body = parsed.data
  const now = new Date()
  const deadline = body.deadline ? new Date(body.deadline) : null

  let title = body.title
  let encryptedPayload = undefined as TaskDocument["encryptedPayload"]

  if (privacyMode) {
    const enc = encryptSensitiveText(body.title)
    if (enc) {
      encryptedPayload = enc
      title = "Private task"
    }
  }

  const doc: Omit<TaskDocument, "_id"> = {
    userId: auth.userId,
    title,
    description: body.description,
    category: body.category,
    location: {
      name: body.location.name,
      coordinates: body.location.coordinates,
    },
    durationMinutes: body.durationMinutes,
    deadline,
    priority: body.priority as TaskPriority,
    constraints: body.constraints,
    status: "pending",
    encryptedPayload,
    createdAt: now,
    updatedAt: now,
  }

  const { insertedId } = await db.collection<TaskDocument>(COLLECTIONS.tasks).insertOne(doc as TaskDocument)
  const created = await db.collection<TaskDocument>(COLLECTIONS.tasks).findOne({ _id: insertedId })
  if (!created) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 })
  }

  await invalidateSchedules(db, auth.userId)

  return NextResponse.json({ task: serializeTask(created) }, { status: 201 })
}

async function invalidateSchedules(db: import("mongodb").Db, userId: ObjectId) {
  await db.collection(COLLECTIONS.schedules).deleteMany({ userId })
}
