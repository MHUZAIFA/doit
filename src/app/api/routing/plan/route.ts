import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { TaskDocument, TaskPriority, UserDocument } from "@/lib/models"
import { openingHoursStatus, type HoursStatus } from "@/lib/opening-hours-status"
import { nominatimSearch, sleep } from "@/lib/services/nominatim"
import {
  fetchElementTags,
  fetchOpeningHoursNear,
} from "@/lib/services/overpass"
import { getUtcEndOfTodayInTimeZone } from "@/lib/today-bounds"
import { ObjectId } from "mongodb"
import {
  lngLatWaypointsToLeaflet,
  orsDirectionsLineString,
  type LngLat,
} from "@/lib/services/openrouteservice"

const bodySchema = z.object({
  taskIds: z.array(z.string()).optional(),
  startLat: z.number().gte(-90).lte(90).optional(),
  startLng: z.number().gte(-180).lte(180).optional(),
})

type Enriched = {
  taskId: string
  title: string
  lat: number
  lng: number
  displayName: string
  hoursTag: string | null
  hoursStatus: HoursStatus
  priority: TaskPriority
  deadline: Date | null
}

function priorityWeight(p: TaskPriority): number {
  return p === "high" ? 3 : p === "medium" ? 2 : 1
}

/**
 * Dated tasks (deadline set) first — priority, then earlier deadline.
 * Tasks with no deadline last — priority, then title.
 */
function compareVisit(a: Enriched, b: Enriched): number {
  const aDated = a.deadline != null
  const bDated = b.deadline != null
  if (aDated && !bDated) return -1
  if (!aDated && bDated) return 1
  const pw = priorityWeight(b.priority) - priorityWeight(a.priority)
  if (pw !== 0) return pw
  if (aDated && bDated) {
    const t = a.deadline!.getTime() - b.deadline!.getTime()
    if (t !== 0) return t
  }
  return a.title.localeCompare(b.title)
}

async function resolveOpeningHoursTag(
  lat: number,
  lng: number,
  osmType: "node" | "way" | "relation" | null,
  osmId: number | null
): Promise<string | null> {
  if (osmType && osmId != null) {
    const tags = await fetchElementTags(osmType, osmId)
    const oh = tags?.opening_hours?.trim()
    if (oh) return oh
  }
  return fetchOpeningHoursNear(lat, lng, 90)
}

export async function POST(request: Request) {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    json = {}
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { taskIds, startLat, startLng } = parsed.data
  const db = await getDb()

  const user = await db.collection<UserDocument>(COLLECTIONS.users).findOne({
    _id: auth.userId,
  })
  const tz = user?.preferences?.timezone ?? "UTC"
  const endOfTodayUtc = getUtcEndOfTodayInTimeZone(tz)

  const filter: Record<string, unknown> = {
    userId: auth.userId,
    status: { $nin: ["cancelled", "completed"] as const },
    $or: [
      { deadline: { $lte: endOfTodayUtc } },
      { deadline: null },
    ],
  }
  if (taskIds?.length) {
    const ids = taskIds.map((id) => new ObjectId(id))
    filter._id = { $in: ids }
  }

  const docs = await db
    .collection<TaskDocument>(COLLECTIONS.tasks)
    .find(filter)
    .limit(40)
    .toArray()

  const enriched: Enriched[] = []
  let nominatimCalls = 0

  for (const doc of docs) {
    const name = doc.location.name?.trim() ?? ""
    const hasStored =
      doc.location.coordinates &&
      typeof doc.location.coordinates.lat === "number" &&
      typeof doc.location.coordinates.lng === "number"

    let lat: number
    let lng: number
    let displayName: string
    let osmType: "node" | "way" | "relation" | null = null
    let osmId: number | null = null

    if (hasStored) {
      lat = doc.location.coordinates!.lat
      lng = doc.location.coordinates!.lng
      displayName = name.trim() ? name : "Saved location"
    } else if (name) {
      if (nominatimCalls > 0) await sleep(1100)
      nominatimCalls += 1
      const hits = await nominatimSearch(name, 1)
      const h = hits[0]
      if (!h) continue
      lat = h.lat
      lng = h.lon
      displayName = h.displayName
      osmType = h.osmType
      osmId = h.osmId
    } else {
      continue
    }

    const hoursTag = await resolveOpeningHoursTag(lat, lng, osmType, osmId)
    const hoursStatus = openingHoursStatus(hoursTag)

    enriched.push({
      taskId: doc._id.toString(),
      title: doc.title,
      lat,
      lng,
      displayName,
      hoursTag,
      hoursStatus,
      priority: doc.priority,
      deadline: doc.deadline ?? null,
    })
  }

  enriched.sort(compareVisit)

  const closed = enriched.filter((p) => p.hoursStatus === "closed")
  const forRouting = enriched

  let routeLine: [number, number][] | null = null
  let orderedTaskIds: string[] = []
  let routingNote: string | null = null

  const hasOrs = Boolean(process.env.OPENROUTESERVICE_API_KEY?.trim())

  if (forRouting.length === 0) {
    routingNote =
      "No matching open tasks with a place name or saved location (due by end of today, earlier, or no deadline). Future deadlines are excluded."
  } else {
    const useStart =
      typeof startLat === "number" &&
      typeof startLng === "number" &&
      !Number.isNaN(startLat) &&
      !Number.isNaN(startLng)

    const canMatrix =
      forRouting.length >= 2 || (forRouting.length === 1 && useStart)

    if (!canMatrix) {
      routingNote =
        "Add another stop or set your start on the map to draw a route (tasks without a deadline are included at the end of the visit list)."
    } else {
      const matrixCoords: LngLat[] = useStart
        ? [[startLng, startLat], ...forRouting.map((p) => [p.lng, p.lat] as LngLat)]
        : forRouting.map((p) => [p.lng, p.lat] as LngLat)

      orderedTaskIds = forRouting.map((p) => p.taskId)

      const orderedCoords = matrixCoords

      const orderHint =
        "Order: priority, then deadline (earlier first) for dated tasks; tasks without a deadline are last."

      if (hasOrs) {
        const line = await orsDirectionsLineString(orderedCoords)
        if (line?.length) {
          routeLine = line.map(([lng, lat]) => [lat, lng] as [number, number])
        } else if (orderedCoords.length >= 2) {
          routeLine = lngLatWaypointsToLeaflet(orderedCoords)
          routingNote =
            `Road geometry unavailable from OpenRouteService. ${orderHint} Check API key, quota, or restart the dev server after changing .env.`
        }
      } else if (orderedCoords.length >= 2) {
        routeLine = lngLatWaypointsToLeaflet(orderedCoords)
        routingNote = `Set OPENROUTESERVICE_API_KEY for road-snapped lines. ${orderHint}`
      }
    }
  }

  return NextResponse.json({
    places: enriched,
    closedPlaces: closed.map((p) => p.taskId),
    routableTaskIds: forRouting.map((p) => p.taskId),
    orderedTaskIds,
    routeLine,
    routingNote,
    nominatimCalls,
  })
}
