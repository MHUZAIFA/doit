import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { UserDocument } from "@/lib/models"
import { parseTaskFromNaturalLanguage } from "@/lib/services/ai"

const currentFormSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    locationName: z.string().optional(),
    lat: z.string().optional(),
    lng: z.string().optional(),
    durationMinutes: z.number().optional(),
    deadline: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  })
  .optional()

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
  currentForm: currentFormSchema,
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

  const fields = await parseTaskFromNaturalLanguage(parsed.data.text, {
    privacyMode,
    currentForm: parsed.data.currentForm ?? null,
  })
  return NextResponse.json({ fields })
}
