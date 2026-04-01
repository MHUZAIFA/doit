import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { UserDocument } from "@/lib/models"
import { parseTaskFromNaturalLanguage } from "@/lib/services/ai"

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
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
  const privacyMode = Boolean(user?.preferences.privacyMode)

  const fields = await parseTaskFromNaturalLanguage(parsed.data.text, { privacyMode })
  return NextResponse.json({ fields })
}
