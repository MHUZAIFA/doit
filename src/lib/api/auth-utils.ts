import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getSession } from "@/lib/auth/session"
import { COOKIE_NAME } from "@/lib/constants"

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
}

export async function requireSessionUser(): Promise<
  { ok: true; userId: ObjectId } | { ok: false; response: NextResponse }
> {
  const session = await getSession()
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  try {
    return { ok: true, userId: new ObjectId(session.sub) }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid session" }, { status: 401 }),
    }
  }
}

export function clearSessionResponse() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, "", { ...sessionCookieOptions, maxAge: 0 })
  return res
}
