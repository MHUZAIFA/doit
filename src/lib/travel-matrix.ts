import type { TaskDocument } from "@/lib/models"
import { distanceMatrix, type LatLng } from "@/lib/services/maps"

/** taskId -> (otherTaskId -> minutes) */
export async function buildTaskTravelMatrix(
  tasks: TaskDocument[]
): Promise<Map<string, Map<string, number>> | null> {
  const withCoords = tasks.filter((t) => t.location.coordinates)
  if (withCoords.length < 2) return null

  const pts: LatLng[] = withCoords.map((t) => t.location.coordinates!)
  const ids = withCoords.map((t) => t._id.toString())

  const dm = await distanceMatrix(pts, pts)
  if (!dm) return null

  const map = new Map<string, Map<string, number>>()
  for (let i = 0; i < ids.length; i++) {
    const row = new Map<string, number>()
    for (let j = 0; j < ids.length; j++) {
      row.set(ids[j], dm.durationsMinutes[i]?.[j] ?? 30)
    }
    map.set(ids[i], row)
  }
  return map
}
