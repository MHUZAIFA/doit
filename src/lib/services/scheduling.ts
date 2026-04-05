import type { TaskDocument } from "@/lib/models"
import type { ScheduleOption } from "@/lib/models"
import { weatherBlocksOutdoorTasks, type WeatherSnapshot } from "@/lib/services/weather"

type InternalTask = {
  id: string
  /** Display label for user-facing alerts — never use {@link InternalTask.id} in copy */
  label: string
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

type MsWindow = { start: number; end: number }

function sleepBlocksForDay(T0: number, sleepStartHm: string, sleepEndHm: string): MsWindow[] {
  const sS = parseHm(sleepStartHm)
  const sE = parseHm(sleepEndHm)
  const min = (m: number) => m * 60 * 1000
  if (sS < sE) {
    return [{ start: T0 + min(sS), end: T0 + min(sE) }]
  }
  if (sS === sE) {
    return []
  }
  return [
    { start: T0, end: T0 + min(sE) },
    { start: T0 + min(sS), end: T0 + min(24 * 60) },
  ]
}

function subtractBlock(windows: MsWindow[], block: MsWindow): MsWindow[] {
  const out: MsWindow[] = []
  for (const w of windows) {
    if (block.end <= w.start || block.start >= w.end) {
      out.push(w)
      continue
    }
    if (w.start < block.start) {
      out.push({ start: w.start, end: Math.min(w.end, block.start) })
    }
    if (w.end > block.end) {
      out.push({ start: Math.max(w.start, block.end), end: w.end })
    }
  }
  return out.filter((x) => x.end > x.start)
}

/** Business window minus sleep, same day as {@link dateStr} (matches {@link dayBounds}). */
function buildAwakeWindows(
  dateStr: string,
  dayStartMs: number,
  dayEndMs: number,
  sleepEnabled: boolean,
  sleepStartHm: string,
  sleepEndHm: string
): MsWindow[] {
  let windows: MsWindow[] = [{ start: dayStartMs, end: dayEndMs }]
  if (!sleepEnabled) {
    return windows
  }
  const T0 = new Date(`${dateStr}T00:00:00.000Z`).getTime()
  for (const block of sleepBlocksForDay(T0, sleepStartHm, sleepEndHm)) {
    windows = subtractBlock(windows, block)
  }
  return windows.filter((w) => w.end > w.start)
}

function alignToAwakeWindows(candidate: number, windows: MsWindow[]): number | null {
  for (const w of windows) {
    if (candidate < w.end) {
      return Math.max(candidate, w.start)
    }
  }
  return null
}

function windowContaining(aligned: number, windows: MsWindow[]): MsWindow | null {
  for (const w of windows) {
    if (aligned >= w.start && aligned < w.end) {
      return w
    }
  }
  return null
}

function priorityWeight(p: TaskDocument["priority"]): number {
  if (p === "high") return 3
  if (p === "medium") return 2
  return 1
}

function taskLabelFromDoc(t: TaskDocument): string {
  const s = (t.title ?? "").trim()
  return s || "Untitled task"
}

function mapTasks(docs: TaskDocument[]): InternalTask[] {
  return docs
    .filter((t) => t.status !== "completed" && t.status !== "cancelled")
    .map((t) => ({
      id: t._id.toString(),
      label: taskLabelFromDoc(t),
      durationMinutes: t.durationMinutes,
      deadline: t.deadline,
      priorityWeight: priorityWeight(t.priority),
      category: t.category,
      outdoorHint: /errand|outdoor|gym|walk|drive/i.test(t.category + t.title),
    }))
}

function tryPack(
  ordered: InternalTask[],
  awakeWindows: MsWindow[],
  dayStartMs: number,
  dayEndMs: number,
  travelMinutes: (a: string, b: string | null) => number,
  weather: WeatherSnapshot | null
): { slots: ScheduleOption["tasks"]; score: number; alerts: string[] } | null {
  if (awakeWindows.length === 0) {
    return null
  }

  const alerts: string[] = []
  const slots: ScheduleOption["tasks"] = []
  let cursor = dayStartMs
  let prevId: string | null = null
  let score = 100

  for (const t of ordered) {
    if (t.outdoorHint && weather && weatherBlocksOutdoorTasks(weather)) {
      alerts.push(`Weather may affect: ${t.label}`)
      score -= 5
    }

    const travel = travelMinutes(t.id, prevId)
    let candidate = cursor + travel * 60 * 1000

    let placed = false
    for (let attempt = 0; attempt < 80 && !placed; attempt++) {
      const aligned = alignToAwakeWindows(candidate, awakeWindows)
      if (aligned === null) {
        return null
      }
      const win = windowContaining(aligned, awakeWindows)
      if (!win) {
        return null
      }
      const dur = t.durationMinutes * 60 * 1000
      if (aligned + dur <= win.end) {
        const start = aligned
        const end = start + dur
        if (end > dayEndMs) {
          return null
        }
        if (t.deadline && end > t.deadline.getTime()) {
          alerts.push(`${t.label} may miss its deadline`)
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
        placed = true
      } else {
        candidate = win.end
      }
    }
    if (!placed) {
      return null
    }
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

export type SchedulePlannerPreferences = {
  businessHoursStart: string
  businessHoursEnd: string
  sleepHoursEnabled: boolean
  sleepHoursStart: string
  sleepHoursEnd: string
}

export function buildScheduleOptions(
  tasks: TaskDocument[],
  dateStr: string,
  prefs: SchedulePlannerPreferences,
  travelMatrix: Map<string, Map<string, number>> | null,
  weather: WeatherSnapshot | null
): { options: ScheduleOption[]; alerts: string[] } {
  const internal = mapTasks(tasks)
  const { start: dayStart, end: dayEnd } = dayBounds(
    dateStr,
    prefs.businessHoursStart,
    prefs.businessHoursEnd
  )
  const dayStartMs = dayStart.getTime()
  const dayEndMs = dayEnd.getTime()

  const awakeWindows = buildAwakeWindows(
    dateStr,
    dayStartMs,
    dayEndMs,
    prefs.sleepHoursEnabled,
    prefs.sleepHoursStart,
    prefs.sleepHoursEnd
  )

  const globalAlerts: string[] = []
  if (internal.length === 0) {
    globalAlerts.push("No active tasks to schedule for this day.")
    return { options: [], alerts: globalAlerts }
  }

  if (prefs.sleepHoursEnabled && awakeWindows.length === 0) {
    globalAlerts.push(
      "Sleep hours cover your entire business window. Adjust sleep or business hours in Settings."
    )
    return { options: [], alerts: globalAlerts }
  }

  for (const t of internal) {
    if (t.deadline && t.deadline.getTime() < dayStart.getTime()) {
      globalAlerts.push(
        `${t.label} has a deadline before business hours on the selected day.`
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
    const packed = tryPack(ordered, awakeWindows, dayStartMs, dayEndMs, travelMinutes, weather)
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
      prefs.sleepHoursEnabled
        ? "Tasks cannot fit around sleep hours and travel buffers. Shorten tasks, extend business hours, or adjust sleep in Settings."
        : "Tasks cannot fit within business hours with travel buffers. Extend hours, shorten tasks, or move deadlines."
    )
  }

  const deduped = globalAlerts.filter((a, i, arr) => arr.indexOf(a) === i)
  return { options, alerts: deduped }
}
