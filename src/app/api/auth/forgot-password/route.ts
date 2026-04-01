import { NextResponse } from "next/server"
import { z } from "zod"

const bodySchema = z.object({
  email: z.email(),
})

/**
 * Generic response to avoid email enumeration. No email is sent until you wire a provider.
 */
export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email, you’ll receive reset instructions when this feature is enabled.",
  })
}
