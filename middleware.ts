import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"
import { COOKIE_NAME } from "@/lib/constants"

const protectedPrefixes = ["/dashboard", "/tasks", "/schedule", "/map", "/chat", "/sleep"]

function getSecret() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) {
    return null
  }
  return new TextEncoder().encode(s)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (!isProtected) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value
  const secret = getSecret()

  if (!secret || !token) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    const res = NextResponse.redirect(url)
    res.cookies.delete(COOKIE_NAME)
    return res
  }
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/tasks",
    "/tasks/:path*",
    "/schedule",
    "/schedule/:path*",
    "/map",
    "/map/:path*",
    "/chat",
    "/chat/:path*",
    "/sleep",
    "/sleep/:path*",
  ],
}
