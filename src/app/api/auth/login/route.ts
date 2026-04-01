import { NextResponse } from "next/server"
import { z } from "zod"
import { createSessionToken } from "@/lib/auth/session"
import { verifyPassword } from "@/lib/auth/password"
import { COOKIE_NAME } from "@/lib/constants"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { UserDocument } from "@/lib/models"
import { sessionCookieOptions } from "@/lib/api/auth-utils"

const bodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
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
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 })
  }

  const { email, password } = parsed.data
  const db = await getDb()
  const user = await db.collection<UserDocument>(COLLECTIONS.users).findOne({
    email: email.toLowerCase(),
  })

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  const token = await createSessionToken({
    sub: user._id.toString(),
    email: user.email,
  })

  const res = NextResponse.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      preferences: user.preferences,
      gamification: user.gamification,
    },
  })
  res.cookies.set(COOKIE_NAME, token, sessionCookieOptions)
  return res
}
