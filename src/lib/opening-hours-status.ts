import OpeningHours from "opening_hours"

export type HoursStatus = "open" | "closed" | "unknown"

const ASSUME_OPEN = "24/7"

/**
 * Maps OSM opening_hours tag to open/closed at `when`.
 * Missing, invalid, or ambiguous tags are treated as 24/7 (always open) for routing.
 */
export function openingHoursStatus(
  tag: string | null | undefined,
  when: Date = new Date()
): HoursStatus {
  if (!tag || !tag.trim()) {
    return openingHoursStatus(ASSUME_OPEN, when)
  }
  try {
    const oh = new OpeningHours(tag.trim())
    // past=false → closed is the string "close" (not "closed"); unknown is "unknown"
    const s = oh.getStateString(when, false)
    if (s === "open") return "open"
    if (s === "unknown") return openingHoursStatus(ASSUME_OPEN, when)
    if (s === "close") return "closed"
    if (oh.getUnknown(when)) return openingHoursStatus(ASSUME_OPEN, when)
    return oh.getState(when) ? "open" : "closed"
  } catch {
    return openingHoursStatus(ASSUME_OPEN, when)
  }
}
