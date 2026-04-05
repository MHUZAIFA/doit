/**
 * Schedule slots store taskId as a string, but BSON round-trips may yield ObjectId or { $oid }.
 */
export function scheduleTaskIdToString(raw: unknown): string {
  if (typeof raw === "string") return raw
  if (raw && typeof raw === "object") {
    const oid = (raw as { $oid?: unknown }).$oid
    if (typeof oid === "string") return oid
    const toStr = (raw as { toString?: () => unknown }).toString
    if (typeof toStr === "function") {
      try {
        const s = toStr.call(raw) as unknown
        if (typeof s === "string" && /^[a-f\d]{24}$/i.test(s)) return s
      } catch {
        /* */
      }
    }
  }
  return ""
}
