import { NextResponse } from "next/server"
import { z } from "zod"
import { createSessionToken } from "@/lib/auth/session"
import { hashPassword } from "@/lib/auth/password"
import { COOKIE_NAME } from "@/lib/constants"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import { defaultGamification, defaultPreferences } from "@/lib/models"
import { sessionCookieOptions } from "@/lib/api/auth-utils"

const bodySchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80),
})

export async function POST(request: Request) {
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

  const { email, password, name } = parsed.data
  const db = await getDb()
  const users = db.collection(COLLECTIONS.users)

  const existing = await users.findOne({ email: email.toLowerCase() })
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const now = new Date()
  const doc = {
    email: email.toLowerCase(),
    name,
    passwordHash,
    preferences: defaultPreferences(),
    gamification: defaultGamification(),
    createdAt: now,
  }

  const { insertedId } = await users.insertOne(doc)
  const id = insertedId.toString()

  const token = await createSessionToken({ sub: id, email: doc.email })
  const res = NextResponse.json({
    user: {
      id,
      email: doc.email,
      name: doc.name,
      preferences: doc.preferences,
      gamification: doc.gamification,
    },
  })
  res.cookies.set(COOKIE_NAME, token, sessionCookieOptions)
  return res
}
