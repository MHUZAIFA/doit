/**
 * Task categories ranked by typical long-term impact on a successful, balanced life.
 * Used when recommending what to work on next after the wake briefing.
 */

export function lifeSuccessWeight(category: string): number {
  const c = category.toLowerCase()
  const map: Record<string, number> = {
    health: 100,
    education: 96,
    work: 92,
    personal: 88,
    other: 55,
    errand: 38,
  }
  return map[c] ?? 52
}

/** Noun phrase: what this category supports (fits “this … task supports …”). */
export function lifeSuccessReasonForCategory(category: string): string {
  const c = category.toLowerCase()
  if (c === "health") return "long-term wellbeing and energy"
  if (c === "education") return "skills and knowledge that compound over decades"
  if (c === "work") return "purpose and financial security"
  if (c === "personal") return "relationships and life satisfaction"
  if (c === "errand") return "clearing logistics so you can focus on deeper goals"
  return "progress on what matters to you over time"
}
