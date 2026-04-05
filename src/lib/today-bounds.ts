import { TZDate } from "@date-fns/tz"
import { endOfDay, startOfDay } from "date-fns"

function normalizeTimeZone(timeZone: string): string {
  let tz = timeZone?.trim() || "UTC"
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date())
  } catch {
    tz = "UTC"
  }
  return tz
}

/** Inclusive UTC instants for the current calendar day in `timeZone` (IANA, e.g. America/Toronto). */
export function getUtcBoundsForTodayInTimeZone(timeZone: string): {
  start: Date
  end: Date
} {
  const tz = normalizeTimeZone(timeZone)
  const now = new TZDate(Date.now(), tz)
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)
  return { start: new Date(dayStart.getTime()), end: new Date(dayEnd.getTime()) }
}

/** Inclusive UTC instants for a calendar day `YYYY-MM-DD` in `timeZone` (IANA). */
export function getUtcBoundsForCalendarDateInTimeZone(
  timeZone: string,
  dateStr: string
): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const tz = normalizeTimeZone(timeZone)
  const [y, m, d] = dateStr.split("-").map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const anchor = TZDate.tz(tz, y, m - 1, d)
  const dayStart = startOfDay(anchor)
  const dayEnd = endOfDay(anchor)
  return { start: new Date(dayStart.getTime()), end: new Date(dayEnd.getTime()) }
}

/** End of the given calendar day in `timeZone` — use with `deadline <= this` like “due by end of this day”. */
export function getUtcEndOfCalendarDateInTimeZone(
  timeZone: string,
  dateStr: string
): Date | null {
  const bounds = getUtcBoundsForCalendarDateInTimeZone(timeZone, dateStr)
  return bounds ? bounds.end : null
}

/** End of “today” in `timeZone` as UTC — use with `deadline <= this` to include overdue + today, exclude future. */
export function getUtcEndOfTodayInTimeZone(timeZone: string): Date {
  const { end } = getUtcBoundsForTodayInTimeZone(timeZone)
  return end
}
