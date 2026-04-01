import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { COOKIE_NAME } from "@/lib/constants"

const getSecret = () => {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET must be set and at least 16 characters")
  }
  return new TextEncoder().encode(s)
}

export type SessionPayload = {
  sub: string
  email: string
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const sub = payload.sub as string | undefined
    const email = payload.email as string | undefined
    if (!sub || !email) return null
    return { sub, email }
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function setSessionCookie(token: string) {
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
