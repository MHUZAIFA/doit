/** Matches common phrasing for clearing the new-task form (client + server fallback). */
export function textImpliesClearForm(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    /\b(clear|empty|reset|wipe)\s+(the\s+)?form\b/.test(t) ||
    /\bclear\s+(all|everything)\b/.test(t) ||
    /^start\s+over\b/.test(t) ||
    /\breset\s+(the\s+)?(form|fields)\b/.test(t)
  )
}
