import OpeningHours from "opening_hours"

export type HoursStatus = "open" | "closed" | "unknown"

/**
 * Maps OSM opening_hours tag to open/closed/unknown at `when`.
 * Invalid or missing tags → unknown (caller should not treat as closed).
 */
export function openingHoursStatus(
  tag: string | null | undefined,
  when: Date = new Date()
): HoursStatus {
  if (!tag || !tag.trim()) return "unknown"
  try {
    const oh = new OpeningHours(tag.trim())
    const s = oh.getStateString(when, false)
    if (s === "open") return "open"
    if (s === "unknown" || s === "close") return "unknown"
    if (s === "closed") return "closed"
    if (oh.getUnknown(when)) return "unknown"
    return oh.getState(when) ? "open" : "closed"
  } catch {
    return "unknown"
  }
}
