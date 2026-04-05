import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import { defaultPreferences, type ThemePreference, type UserDocument } from "@/lib/models"

const patchSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  privacyMode: z.boolean().optional(),
  timezone: z.string().min(1).max(64).optional(),
  /** `name|||lang` can be long on some systems */
  wakeVoiceNameIncludes: z.string().max(512).optional(),
  wakeGreeting: z.string().min(0).max(300).optional(),
  wakeMusicMuted: z.boolean().optional(),
})

export async function PATCH(request: Request) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

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

  const updates: Record<string, unknown> = {}
  const p = parsed.data
  if (p.theme !== undefined) updates["preferences.theme"] = p.theme as ThemePreference
  if (p.businessHoursStart !== undefined)
    updates["preferences.businessHoursStart"] = p.businessHoursStart
  if (p.businessHoursEnd !== undefined) updates["preferences.businessHoursEnd"] = p.businessHoursEnd
  if (p.privacyMode !== undefined) updates["preferences.privacyMode"] = p.privacyMode
  if (p.timezone !== undefined) updates["preferences.timezone"] = p.timezone
  if (p.wakeVoiceNameIncludes !== undefined)
    updates["preferences.wakeVoiceNameIncludes"] = p.wakeVoiceNameIncludes
  if (p.wakeGreeting !== undefined) updates["preferences.wakeGreeting"] = p.wakeGreeting
  if (p.wakeMusicMuted !== undefined) updates["preferences.wakeMusicMuted"] = p.wakeMusicMuted

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 })
  }

  const db = await getDb()
  const user = await db.collection<UserDocument>(COLLECTIONS.users).findOneAndUpdate(
    { _id: auth.userId },
    { $set: updates },
    { returnDocument: "after" }
  )

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({
    preferences: { ...defaultPreferences(), ...user.preferences },
  })
}
