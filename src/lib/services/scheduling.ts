import type { TaskDocument } from "@/lib/models"
import type { ScheduleOption } from "@/lib/models"
import { weatherBlocksOutdoorTasks, type WeatherSnapshot } from "@/lib/services/weather"

type InternalTask = {
  id: string
  durationMinutes: number
  deadline: Date | null
  priorityWeight: number
  category: string
  outdoorHint: boolean
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10))
  return (h || 0) * 60 + (m || 0)
}

function dayBounds(dateStr: string, startHm: string, endHm: string): { start: Date; end: Date } {
  const startMin = parseHm(startHm)
  const endMin = parseHm(endHm)
  const day = new Date(`${dateStr}T00:00:00.000Z`)
  const start = new Date(day.getTime() + startMin * 60 * 1000)
  const end = new Date(day.getTime() + endMin * 60 * 1000)
  return { start, end }
}

function priorityWeight(p: TaskDocument["priority"]): number {
  if (p === "high") return 3
  if (p === "medium") return 2
  return 1
}

function mapTasks(docs: TaskDocument[]): InternalTask[] {
  return docs
    .filter((t) => t.status !== "completed" && t.status !== "cancelled")
    .map((t) => ({
      id: t._id.toString(),
      durationMinutes: t.durationMinutes,
      deadline: t.deadline,
      priorityWeight: priorityWeight(t.priority),
      category: t.category,
      outdoorHint: /errand|outdoor|gym|walk|drive/i.test(t.category + t.title),
    }))
}

function tryPack(
  ordered: InternalTask[],
  dayStart: Date,
  dayEnd: Date,
  travelMinutes: (a: string, b: string | null) => number,
  weather: WeatherSnapshot | null
): { slots: ScheduleOption["tasks"]; score: number; alerts: string[] } | null {
  const alerts: string[] = []
  const slots: ScheduleOption["tasks"] = []
  let cursor = dayStart.getTime()
  let prevId: string | null = null
  let score = 100

  for (const t of ordered) {
    if (t.outdoorHint && weather && weatherBlocksOutdoorTasks(weather)) {
      alerts.push(`Weather may affect outdoor task: ${t.id}`)
      score -= 5
    }

    const travel = travelMinutes(t.id, prevId)
    cursor += travel * 60 * 1000
    const start = cursor
    const end = start + t.durationMinutes * 60 * 1000

    if (end > dayEnd.getTime()) {
      return null
    }

    if (t.deadline && end > t.deadline.getTime()) {
      alerts.push(`Task ${t.id} may miss deadline`)
      score -= 15
    }

    slots.push({
      taskId: t.id,
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
      locked: false,
    })
    prevId = t.id
    cursor = end
  }

  return { slots, score, alerts }
}

const sortFns = {
  deadline: (a: InternalTask, b: InternalTask) => {
    const ad = a.deadline?.getTime() ?? Infinity
    const bd = b.deadline?.getTime() ?? Infinity
    return ad - bd || b.priorityWeight - a.priorityWeight
  },
  priority: (a: InternalTask, b: InternalTask) =>
    b.priorityWeight - a.priorityWeight || (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity),
  duration: (a: InternalTask, b: InternalTask) =>
    a.durationMinutes - b.durationMinutes || b.priorityWeight - a.priorityWeight,
}

export function buildScheduleOptions(
  tasks: TaskDocument[],
  dateStr: string,
  prefs: { businessHoursStart: string; businessHoursEnd: string },
  travelMatrix: Map<string, Map<string, number>> | null,
  weather: WeatherSnapshot | null
): { options: ScheduleOption[]; alerts: string[] } {
  const internal = mapTasks(tasks)
  const { start: dayStart, end: dayEnd } = dayBounds(
    dateStr,
    prefs.businessHoursStart,
    prefs.businessHoursEnd
  )

  const globalAlerts: string[] = []
  if (internal.length === 0) {
    globalAlerts.push("No active tasks to schedule for this day.")
    return { options: [], alerts: globalAlerts }
  }

  for (const t of internal) {
    if (t.deadline && t.deadline.getTime() < dayStart.getTime()) {
      globalAlerts.push(
        `Task ${t.id} has a deadline before business hours on the selected day.`
      )
    }
  }

  const defaultTravel = 25
  const travelMinutes = (toId: string, fromId: string | null) => {
    if (!fromId || !travelMatrix) return defaultTravel
    const row = travelMatrix.get(fromId)
    return row?.get(toId) ?? defaultTravel
  }

  const variants: Array<keyof typeof sortFns> = ["deadline", "priority", "duration"]
  const options: ScheduleOption[] = []

  for (const key of variants) {
    const ordered = [...internal].sort(sortFns[key])
    const packed = tryPack(ordered, dayStart, dayEnd, travelMinutes, weather)
    if (packed) {
      options.push({
        optionId: `opt-${key}`,
        tasks: packed.slots,
        score: Math.max(0, packed.score),
      })
      globalAlerts.push(...packed.alerts)
    }
  }

  if (options.length === 0) {
    globalAlerts.push(
      "Tasks cannot fit within business hours with travel buffers. Extend hours, shorten tasks, or move deadlines."
    )
  }

  const deduped = globalAlerts.filter((a, i, arr) => arr.indexOf(a) === i)
  return { options, alerts: deduped }
}
