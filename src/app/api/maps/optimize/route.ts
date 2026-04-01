import { NextResponse } from "next/server"
import { z } from "zod"
import { ObjectId } from "mongodb"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { TaskDocument } from "@/lib/models"
import { distanceMatrix, type LatLng } from "@/lib/services/maps"

const bodySchema = z.object({
  taskIds: z.array(z.string().min(1)).min(2).max(25),
})

/** Nearest-neighbor order starting from the first task in the request list */
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
  const oids = parsed.data.taskIds.map((id) => new ObjectId(id))
  const tasks = await db
    .collection<TaskDocument>(COLLECTIONS.tasks)
    .find({ _id: { $in: oids }, userId: auth.userId })
    .toArray()

  const byId = new Map(tasks.map((t) => [t._id.toString(), t]))
  const ordered: TaskDocument[] = []
  for (const id of parsed.data.taskIds) {
    const t = byId.get(id)
    if (t) ordered.push(t)
  }

  const withCoords = ordered.filter((t) => t.location.coordinates)
  if (withCoords.length < 2) {
    return NextResponse.json({
      orderedIds: ordered.map((t) => t._id.toString()),
      note: "Need at least two tasks with coordinates for distance optimization.",
    })
  }

  const pts: LatLng[] = withCoords.map((t) => t.location.coordinates!)
  const dm = await distanceMatrix(pts, pts)
  if (!dm) {
    return NextResponse.json({
      orderedIds: ordered.map((t) => t._id.toString()),
      note: "Distance Matrix unavailable (check GOOGLE_MAPS_API_KEY).",
    })
  }

  const idList = withCoords.map((t) => t._id.toString())
  const indexMap = new Map(idList.map((id, i) => [id, i]))
  const visited = new Set<string>()
  const route: string[] = []
  let current = idList[0]!
  route.push(current)
  visited.add(current)

  while (visited.size < idList.length) {
    const from = indexMap.get(current)!
    let best: string | null = null
    let bestMin = Infinity
    for (const id of idList) {
      if (visited.has(id)) continue
      const to = indexMap.get(id)!
      const d = dm.durationsMinutes[from]?.[to] ?? 1e9
      if (d < bestMin) {
        bestMin = d
        best = id
      }
    }
    if (!best) break
    route.push(best)
    visited.add(best)
    current = best
  }

  const extras = ordered.filter((t) => !t.location.coordinates).map((t) => t._id.toString())
  return NextResponse.json({
    orderedIds: [...route, ...extras],
    totalTravelMinutesApprox: route.length > 1 ? "see Google Maps for exact" : 0,
  })
}
