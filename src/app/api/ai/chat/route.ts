import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { UserDocument } from "@/lib/models"
import { summarizeSchedulingContext } from "@/lib/services/ai"

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
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

  const db = await getDb()
  const user = await db.collection<UserDocument>(COLLECTIONS.users).findOne({
    _id: auth.userId,
  })
  if (user?.preferences.privacyMode) {
    return NextResponse.json({
      reply:
        "Privacy mode is on: messages are not sent to external AI. Try turning privacy mode off in settings or use manual planning.",
    })
  }

  const reply = await summarizeSchedulingContext(parsed.data.message)
  return NextResponse.json({ reply })
}
