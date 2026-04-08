import { cn } from "@/lib/utils"

export type PriorityBadgeVariant = "default" | "secondary" | "destructive"

const PRIORITY_VARIANT: Record<string, PriorityBadgeVariant> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
}

export function priorityBadgeVariant(priority: string): PriorityBadgeVariant {
  return PRIORITY_VARIANT[priority] ?? "secondary"
}

/** Tab order for the tasks page (value → filter). "Other" includes `other` and any custom category. */
export const TASK_CATEGORY_TABS = [
  { value: "all", label: "All" },
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "health", label: "Health" },
  { value: "errand", label: "Errand" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
] as const

const PRIMARY_CATEGORY = new Set(["work", "personal", "health", "errand", "education"])

/** Whether a task belongs under the given category tab. */
export function taskMatchesCategoryTab(taskCategory: string, tab: string): boolean {
  if (tab === "all") return true
  const c = taskCategory.trim().toLowerCase()
  if (tab === "other") {
    return c === "other" || !PRIMARY_CATEGORY.has(c)
  }
  return c === tab
}

/** Tinted outline-style badges per category (work, personal, health, errand, education, other). */
const CATEGORY_CLASS: Record<string, string> = {
  work: "border-violet-500/45 bg-violet-500/10 text-violet-800 dark:border-violet-400/40 dark:bg-violet-400/12 dark:text-violet-100",
  personal:
    "border-sky-500/45 bg-sky-500/10 text-sky-900 dark:border-sky-400/40 dark:bg-sky-400/12 dark:text-sky-50",
  health:
    "border-emerald-500/45 bg-emerald-500/10 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-400/12 dark:text-emerald-50",
  errand:
    "border-amber-500/45 bg-amber-500/10 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/12 dark:text-amber-50",
  education:
    "border-indigo-500/45 bg-indigo-500/10 text-indigo-950 dark:border-indigo-400/40 dark:bg-indigo-400/12 dark:text-indigo-50",
  other: "border-border bg-muted/60 text-muted-foreground",
}

export function categoryBadgeClassName(category: string): string {
  const k = category.toLowerCase()
  return CATEGORY_CLASS[k] ?? CATEGORY_CLASS.other
}

/** Full className for category Badge (outline + tint). */
export function categoryBadgeClass(category: string): string {
  return cn("capitalize", categoryBadgeClassName(category))
}
