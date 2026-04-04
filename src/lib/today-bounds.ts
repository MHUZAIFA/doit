import { TZDate } from "@date-fns/tz"
import { endOfDay, startOfDay } from "date-fns"

/** Inclusive UTC instants for the current calendar day in `timeZone` (IANA, e.g. America/Toronto). */
export function getUtcBoundsForTodayInTimeZone(timeZone: string): {
  start: Date
  end: Date
} {
  let tz = timeZone?.trim() || "UTC"
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date())
  } catch {
    tz = "UTC"
  }
  const now = new TZDate(Date.now(), tz)
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)
  return { start: new Date(dayStart.getTime()), end: new Date(dayEnd.getTime()) }
}

/** End of “today” in `timeZone` as UTC — use with `deadline <= this` to include overdue + today, exclude future. */
export function getUtcEndOfTodayInTimeZone(timeZone: string): Date {
  const { end } = getUtcBoundsForTodayInTimeZone(timeZone)
  return end
}
