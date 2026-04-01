import { NextResponse } from "next/server"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { NotificationDocument } from "@/lib/models"

export async function GET() {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const db = await getDb()
  const items = await db
    .collection<NotificationDocument>(COLLECTIONS.notifications)
    .find({ userId: auth.userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  return NextResponse.json({
    notifications: items.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
  })
}
