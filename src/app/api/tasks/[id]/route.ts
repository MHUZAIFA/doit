import { NextResponse } from "next/server"
import { z } from "zod"
import { ObjectId } from "mongodb"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { TaskDocument, TaskPriority, TaskStatus } from "@/lib/models"
import { encryptSensitiveText } from "@/lib/services/privacy"
import { applyTaskCompleted } from "@/lib/services/gamification"
import { serializeTask } from "@/lib/serialize"
import type { UserDocument } from "@/lib/models"

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  category: z.string().min(1).max(64).optional(),
  location: z
    .object({
      name: z.string().max(500),
      coordinates: z
        .object({
          lat: z.number(),
          lng: z.number(),
        })
        .optional(),
    })
    .optional(),
  durationMinutes: z.number().int().min(15).max(24 * 60).optional(),
  deadline: z.union([z.iso.datetime(), z.null()]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  constraints: z.record(z.string(), z.any()).optional(),
  status: z.enum(["pending", "scheduled", "completed", "cancelled"]).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const { id } = await params
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const db = await getDb()
  const task = await db.collection<TaskDocument>(COLLECTIONS.tasks).findOne({
    _id: oid,
    userId: auth.userId,
  })
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ task: serializeTask(task) })
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const { id } = await params
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = await getDb()
  const existing = await db.collection<TaskDocument>(COLLECTIONS.tasks).findOne({
    _id: oid,
    userId: auth.userId,
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const user = await db.collection<UserDocument>(COLLECTIONS.users).findOne({
    _id: auth.userId,
  })
  const privacyMode = Boolean(user?.preferences.privacyMode)

  const p = parsed.data
  const $set: Record<string, unknown> = { updatedAt: new Date() }
  const $unset: Record<string, ""> = {}

  if (p.description !== undefined) $set.description = p.description ?? undefined
  if (p.category !== undefined) $set.category = p.category
  if (p.location !== undefined) $set.location = p.location
  if (p.durationMinutes !== undefined) $set.durationMinutes = p.durationMinutes
  if (p.deadline !== undefined) $set.deadline = p.deadline ? new Date(p.deadline) : null
  if (p.priority !== undefined) $set.priority = p.priority as TaskPriority
  if (p.constraints !== undefined) $set.constraints = p.constraints
  if (p.status !== undefined) $set.status = p.status as TaskStatus

  if (p.title !== undefined) {
    if (privacyMode) {
      const enc = encryptSensitiveText(p.title)
      if (enc) {
        $set.encryptedPayload = enc
        $set.title = "Private task"
      } else {
        $set.title = p.title
        $unset.encryptedPayload = ""
      }
    } else {
      $set.title = p.title
      $unset.encryptedPayload = ""
    }
  }

  const updateFilter: import("mongodb").UpdateFilter<TaskDocument> = { $set }
  if (Object.keys($unset).length > 0) updateFilter.$unset = $unset

  await db.collection<TaskDocument>(COLLECTIONS.tasks).updateOne({ _id: oid }, updateFilter)

  const updated = await db.collection<TaskDocument>(COLLECTIONS.tasks).findOne({ _id: oid })
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  if (p.status === "completed" && existing.status !== "completed" && user) {
    const g = applyTaskCompleted(user.gamification)
    await db.collection<UserDocument>(COLLECTIONS.users).updateOne(
      { _id: auth.userId },
      { $set: { gamification: g } }
    )
    await db.collection(COLLECTIONS.notifications).insertOne({
      userId: auth.userId,
      type: "gamification",
      title: "Task completed",
      body: `Great work! Streak: ${g.streak} days · Score ${g.productivityScore}`,
      read: false,
      createdAt: new Date(),
    })
  }

  await db.collection(COLLECTIONS.schedules).deleteMany({ userId: auth.userId })

  return NextResponse.json({ task: serializeTask(updated) })
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const { id } = await params
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const db = await getDb()
  const r = await db.collection<TaskDocument>(COLLECTIONS.tasks).deleteOne({
    _id: oid,
    userId: auth.userId,
  })
  if (r.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await db.collection(COLLECTIONS.schedules).deleteMany({ userId: auth.userId })

  return NextResponse.json({ ok: true })
}
