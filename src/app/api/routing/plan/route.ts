import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { getDb } from "@/lib/db"
import { COLLECTIONS } from "@/lib/constants"
import type { TaskDocument } from "@/lib/models"
import { openingHoursStatus, type HoursStatus } from "@/lib/opening-hours-status"
import { nominatimSearch, sleep } from "@/lib/services/nominatim"
import {
  fetchElementTags,
  fetchOpeningHoursNear,
} from "@/lib/services/overpass"
import { ObjectId } from "mongodb"
import {
  greedyDurationOrder,
  orsDirectionsLineString,
  orsMatrix,
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
  const filter: Record<string, unknown> = { userId: auth.userId, status: { $ne: "cancelled" as const } }
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
    })
  }

  const routable = enriched.filter((p) => p.hoursStatus !== "closed")
  const closed = enriched.filter((p) => p.hoursStatus === "closed")

  let routeLine: [number, number][] | null = null
  let orderedTaskIds: string[] = []
  let routingNote: string | null = null

  const hasOrs = Boolean(process.env.OPENROUTESERVICE_API_KEY?.trim())

  if (!hasOrs) {
    routingNote = "Set OPENROUTESERVICE_API_KEY for turn-by-turn geometry on the map."
  } else if (routable.length === 0) {
    routingNote = "No routable stops (all closed or none geocoded)."
  } else {
    const useStart =
      typeof startLat === "number" &&
      typeof startLng === "number" &&
      !Number.isNaN(startLat) &&
      !Number.isNaN(startLng)

    const canMatrix =
      routable.length >= 2 || (routable.length === 1 && useStart)

    if (!canMatrix) {
      routingNote =
        "Add another open stop or set your start on the map to draw a route."
    } else {
      const matrixCoords: LngLat[] = useStart
        ? [[startLng, startLat], ...routable.map((p) => [p.lng, p.lat] as LngLat)]
        : routable.map((p) => [p.lng, p.lat] as LngLat)

      const matrix = await orsMatrix(matrixCoords)
      if (matrix?.length) {
        const order = greedyDurationOrder(matrix, 0)
        const orderedCoords = order.map((i) => matrixCoords[i])
        orderedTaskIds = order
          .filter((i) => !(useStart && i === 0))
          .map((i) => {
            const idx = useStart ? i - 1 : i
            return routable[idx]?.taskId ?? ""
          })
          .filter(Boolean)

        const line = await orsDirectionsLineString(orderedCoords)
        if (line?.length) {
          routeLine = line.map(([lng, lat]) => [lat, lng] as [number, number])
        }
      } else {
        routingNote = "Could not build a duration matrix (check ORS quota or coordinates)."
      }
    }
  }

  return NextResponse.json({
    places: enriched,
    closedPlaces: closed.map((p) => p.taskId),
    routableTaskIds: routable.map((p) => p.taskId),
    orderedTaskIds,
    routeLine,
    routingNote,
    nominatimCalls,
  })
}
