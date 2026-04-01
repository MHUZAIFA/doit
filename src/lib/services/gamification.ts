import type { UserGamification } from "@/lib/models"

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export function applyTaskCompleted(g: UserGamification): UserGamification {
  const today = todayUtc()
  let streak = g.streak
  if (g.lastActiveDate !== today) {
    if (!g.lastActiveDate) {
      streak = 1
    } else {
      const y = new Date()
      y.setUTCDate(y.getUTCDate() - 1)
      const yesterday = y.toISOString().slice(0, 10)
      streak = g.lastActiveDate === yesterday ? g.streak + 1 : 1
    }
  }

  const tasksCompleted = g.tasksCompleted + 1
  const productivityScore = Math.min(100, g.productivityScore + 3)

  return {
    streak,
    lastActiveDate: today,
    productivityScore,
    tasksCompleted,
  }
}
