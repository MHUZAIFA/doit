import { format } from "date-fns"
import { TZDate } from "@date-fns/tz"
import { NextResponse } from "next/server"
import { requireSessionUser } from "@/lib/api/auth-utils"
import { COLLECTIONS } from "@/lib/constants"
import { getDb } from "@/lib/db"
import type { TaskDocument, UserDocument } from "@/lib/models"
import { lifeSuccessWeight } from "@/lib/life-success"
import { serializeTask } from "@/lib/serialize"
import { wakeNextTaskRecommendation } from "@/lib/services/ai"

type TaskRow = ReturnType<typeof serializeTask>

export async function POST() {
  const auth = await requireSessionUser()
  if (!auth.ok) return auth.response

  const db = await getDb()
  const user = await db.collection<UserDocument>(COLLECTIONS.users).findOne({ _id: auth.userId })
  const privacyMode = Boolean(user?.preferences.privacyMode)
  const timeZone = user?.preferences.timezone?.trim() || "UTC"

  const docs = await db
    .collection<TaskDocument>(COLLECTIONS.tasks)
    .find({ userId: auth.userId })
    .toArray()

  const tasks = docs.map((d) => serializeTask(d))
  const pending = tasks.filter((t) => t.status !== "completed")

  if (pending.length === 0) {
    return NextResponse.json({
      recommendation: "No open tasks—you're caught up for now.",
    })
  }

  if (privacyMode) {
    return NextResponse.json({
      recommendation: ruleBasedRecommendation(pending, timeZone),
    })
  }

  const today = calendarTodayInTz(timeZone)
  const dueToday = pending.filter((t) => {
    if (!t.deadline) return false
    return deadlineCalendarDateInTz(t.deadline, timeZone) === today
  })
  const dueIds = new Set(dueToday.map((t) => t.id))
  const otherOpen = pending.filter((t) => !dueIds.has(t.id))

  const line = (t: TaskRow) =>
    `- ${t.title} | ${t.category} | ${t.priority} priority | deadline: ${t.deadline ? t.deadline.slice(0, 10) : "none"}`
  const blockToday = dueToday.map(line).join("\n")
  const blockOther = otherOpen.map(line).join("\n")

  const prompt = `Today's date (YYYY-MM-DD): ${today}.

Open tasks DUE TODAY (calendar deadline is today, ${dueToday.length} total):
${blockToday || "(none)"}

Other REMAINING open tasks (not due today—undated, future, or overdue, ${otherOpen.length} total):
${blockOther || "(none)"}

Pick one task to do next. Prefer the due-today list when it is non-empty; otherwise use the other open list. Answer only about these tasks—no general advice. Do not mention how many tasks have no deadline, how many are due another day, or criticize missing deadlines.`

  try {
    const recommendation = await wakeNextTaskRecommendation(prompt)
    if (!recommendation.trim()) {
      return NextResponse.json({ recommendation: ruleBasedRecommendation(pending, timeZone) })
    }
    return NextResponse.json({ recommendation })
  } catch {
    return NextResponse.json({
      recommendation: ruleBasedRecommendation(pending, timeZone),
    })
  }
}

function sortByPriorityThenDeadline(a: TaskRow, b: TaskRow): number {
  const w = (p: string) => (p === "high" ? 0 : p === "medium" ? 1 : 2)
  const pd = w(a.priority) - w(b.priority)
  if (pd !== 0) return pd
  if (!a.deadline && !b.deadline) return 0
  if (!a.deadline) return 1
  if (!b.deadline) return -1
  return a.deadline.localeCompare(b.deadline)
}

/** After urgency (due today), rank by life-success category, then priority, then deadline. */
function sortByLifeSuccessThenPriorityThenDeadline(a: TaskRow, b: TaskRow): number {
  const lw = lifeSuccessWeight(b.category) - lifeSuccessWeight(a.category)
  if (lw !== 0) return lw
  return sortByPriorityThenDeadline(a, b)
}

function calendarTodayInTz(timeZone: string): string {
  let tz = timeZone
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date())
  } catch {
    tz = "UTC"
  }
  return format(new TZDate(Date.now(), tz), "yyyy-MM-dd")
}

function deadlineCalendarDateInTz(deadlineIso: string, timeZone: string): string {
  let tz = timeZone
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date())
  } catch {
    tz = "UTC"
  }
  return format(new TZDate(new Date(deadlineIso).getTime(), tz), "yyyy-MM-dd")
}

function ruleBasedRecommendation(pending: TaskRow[], timeZone: string): string {
  const today = calendarTodayInTz(timeZone)
  const dueToday = pending.filter((t) => {
    if (!t.deadline) return false
    return deadlineCalendarDateInTz(t.deadline, timeZone) === today
  })
  if (dueToday.length) {
    const sorted = [...dueToday].sort(sortByLifeSuccessThenPriorityThenDeadline)
    const t = sorted[0]!
    return `Start with ${t.title} — it's due today.`
  }

  const sorted = [...pending].sort(sortByLifeSuccessThenPriorityThenDeadline)
  const t = sorted[0]!
  if (t.deadline) {
    const d = t.deadline.slice(0, 10)
    return `Next, tackle ${t.title} — deadline ${d}.`
  }
  return `Next, work on ${t.title} — still open on your list.`
}
