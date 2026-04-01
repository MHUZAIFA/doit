import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getSession } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { UserDocument } from "@/lib/models"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ user: null })
  }

  try {
    const db = await getDb()
    const user = await db.collection<UserDocument>(COLLECTIONS.users).findOne({
      _id: new ObjectId(session.sub),
    })
    if (!user) {
      return NextResponse.json({ user: null })
    }
    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        preferences: user.preferences,
        gamification: user.gamification,
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
