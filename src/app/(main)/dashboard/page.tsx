"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, ListTodo, MapPin, MessageSquare, Plus } from "lucide-react"
import { toast } from "sonner"

import { type TaskView } from "@/components/task-card"
import { TaskList } from "@/components/task-list-row"
import { ScheduleTimeline, type TimelineBlock } from "@/components/timeline"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { localDateInputValue } from "@/lib/date"
import { cn } from "@/lib/utils"

function formatDashboardDate(isoDate: string) {
  const parts = isoDate.split("-")
  if (parts.length !== 3) return isoDate
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return isoDate
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

type Me = {
  user: {
    name: string
    preferences: { privacyMode: boolean }
    gamification: { streak: number; productivityScore: number; tasksCompleted: number }
  } | null
}

type ScheduleRes = {
  schedule: {
    scheduleOptions: Array<{
      optionId: string
      score: number
      tasks: Array<{ taskId: string; startTime: string; endTime: string }>
    }>
    alerts: string[]
  } | null
}

type InsightsPayload = {
  productivityPattern: string
  commonDelays: string[]
}

export default function DashboardPage() {
  const [me, setMe] = useState<Me["user"]>(null)
  const [tasks, setTasks] = useState<TaskView[]>([])
  const [schedule, setSchedule] = useState<ScheduleRes["schedule"]>(null)
  const [insights, setInsights] = useState<InsightsPayload | null>(null)
  const [insightsFailed, setInsightsFailed] = useState(false)
  const [insightsLoaded, setInsightsLoaded] = useState(false)
  const [privacyLoading, setPrivacyLoading] = useState(false)

  const today = useMemo(() => localDateInputValue(), [])
  const todayLabel = useMemo(() => formatDashboardDate(today), [today])

  const load = useCallback(async () => {
    const [meR, tasksR, schR, insRes] = await Promise.all([
      fetch("/api/auth/me").then((r) => r.json() as Promise<Me>),
      fetch("/api/tasks").then((r) => r.json() as Promise<{ tasks: TaskView[] }>),
      fetch(`/api/schedules?date=${today}`).then((r) => r.json() as Promise<ScheduleRes>),
      fetch("/api/ai/insights").then(async (r) => {
        if (!r.ok) return { ok: false as const }
        const j = (await r.json()) as { insights?: InsightsPayload }
        return { ok: true as const, insights: j.insights }
      }),
    ])
    setMe(meR.user)
    setTasks(tasksR.tasks ?? [])
    setSchedule(schR.schedule)
    if (insRes.ok) {
      setInsights(insRes.insights ?? null)
      setInsightsFailed(false)
    } else {
      setInsights(null)
      setInsightsFailed(true)
    }
    setInsightsLoaded(true)
  }, [today])

  useEffect(() => {
    load()
  }, [load])

  async function completeTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    })
    if (!res.ok) {
      toast.error("Could not update task")
      return
    }
    toast.success("Task completed")
    load()
  }

  async function reopenTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    })
    if (!res.ok) {
      toast.error("Could not reopen task")
      return
    }
    toast.message("Task reopened")
    load()
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Could not delete task")
      return
    }
    toast.success("Task deleted")
    load()
  }

  const firstOption = schedule?.scheduleOptions?.[0]
  const blocks: TimelineBlock[] = useMemo(() => {
    if (!firstOption?.tasks.length) return []
    const titleById = Object.fromEntries(tasks.map((t) => [t.id, t.title]))
    return firstOption.tasks.map((slot) => ({
      id: slot.taskId,
      label: titleById[slot.taskId] ?? "Task",
      start: new Date(slot.startTime),
      end: new Date(slot.endTime),
      tone: "default" as const,
    }))
  }, [firstOption, tasks])

  const { activeTasks, completedTasks } = useMemo(() => {
    const active: TaskView[] = []
    const done: TaskView[] = []
    for (const t of tasks) {
      if (t.status === "completed") done.push(t)
      else active.push(t)
    }
    return { activeTasks: active, completedTasks: done }
  }, [tasks])

  async function togglePrivacy(checked: boolean) {
    setPrivacyLoading(true)
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacyMode: checked }),
      })
      if (!res.ok) throw new Error()
      toast.success(checked ? "Privacy mode on" : "Privacy mode off")
      load()
    } catch {
      toast.error("Could not update privacy")
    } finally {
      setPrivacyLoading(false)
    }
  }

  const quickLinks = [
    { href: "/tasks/new", label: "New task", icon: Plus },
    { href: "/tasks", label: "All tasks", icon: ListTodo },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/map", label: "Map", icon: MapPin },
    { href: "/chat", label: "Chat", icon: MessageSquare },
  ] as const

  return (
    <div className="space-y-10">
      <section className="mb-0 mt-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {todayLabel}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">
              {me ? `Hi, ${me.name.split(" ")[0]}` : "Dashboard"}
            </h1>
            <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Your plan for today, open work, and a quick read on how things are trending.
            </p>
          </div>
          <Link
            href="/tasks/new"
            className={cn(
              buttonVariants(),
              "inline-flex h-10 shrink-0 items-center gap-2 self-start sm:self-auto"
            )}
          >
            <Plus className="size-4" aria-hidden />
            New task
          </Link>
        </div>

        <nav
          className="flex flex-wrap gap-x-1 gap-y-2 border-b border-border pb-3 dark:border-white/10"
          aria-label="Quick navigation"
        >
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-white/5"
            >
              <Icon className="size-3.5 opacity-70" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </section>

      {me ? (
        <section
          className="grid grid-cols-3 divide-x divide-border border-y border-border dark:divide-white/10 dark:border-white/10"
          aria-label="Your stats"
        >
          <div className="px-3 py-4 first:pl-0 sm:px-5 sm:py-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Streak</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{me.gamification.streak}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">days in a row</p>
          </div>
          <div className="px-3 py-4 sm:px-5 sm:py-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Score</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{me.gamification.productivityScore}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">productivity</p>
          </div>
          <div className="px-3 py-4 last:pr-0 sm:px-5 sm:py-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{me.gamification.tasksCompleted}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">tasks total</p>
          </div>
        </section>
      ) : null}

      <section className="flex flex-wrap items-center gap-3">
        <Checkbox
          id="privacy"
          checked={Boolean(me?.preferences.privacyMode)}
          disabled={privacyLoading || !me}
          onCheckedChange={(v) => togglePrivacy(v === true)}
        />
        <Label htmlFor="privacy" className="text-sm font-normal leading-snug text-muted-foreground">
          Privacy mode — skip external AI; encrypt titles when an encryption key is set.
        </Label>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <ScheduleTimeline blocks={blocks} />
        <Card
          size="sm"
          className="rounded-[var(--radius-xs)] border-2 border-border ring-0 dark:border-white/10"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Insights</CardTitle>
            <CardDescription>From your tasks and completion history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {!insightsLoaded ? (
              <p className="animate-pulse text-muted-foreground">Loading insights…</p>
            ) : insightsFailed ? (
              <p>Insights couldn&apos;t load. Check your session or try again in a moment.</p>
            ) : insights ? (
              <>
                <p className="text-foreground/90">{insights.productivityPattern}</p>
                {insights.commonDelays.length > 0 ? (
                  <ul className="space-y-1.5 border-l-2 border-border pl-3 dark:border-white/15">
                    {insights.commonDelays.map((c) => (
                      <li key={c} className="text-[13px] leading-relaxed">
                        {c}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={async () => {
                    await fetch("/api/ai/insights", { method: "POST" })
                    load()
                  }}
                >
                  Refresh insights
                </Button>
              </>
            ) : (
              <p>No insights yet. Add tasks or refresh after you&apos;ve been active for a bit.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {schedule?.alerts?.length ? (
        <section
          className="border-l-2 border-amber-500/60 py-1 pl-4 text-sm text-amber-950 dark:border-amber-400/50 dark:text-amber-100/90"
          role="status"
        >
          {schedule.alerts.map((a) => (
            <p key={a} className="leading-relaxed">
              {a}
            </p>
          ))}
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-medium tracking-tight">Tasks</h2>
            <span className="text-sm tabular-nums text-muted-foreground">
              {activeTasks.length} open
              {completedTasks.length > 0 ? ` · ${completedTasks.length} done` : ""}
            </span>
          </div>
          <Link
            href="/schedule"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex items-center gap-1.5 self-start sm:self-auto"
            )}
          >
            <CalendarDays className="size-3.5" aria-hidden />
            Open schedule
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-[var(--radius-xs)] border-2 border-dashed border-border px-6 py-12 text-center dark:border-white/15">
            <ListTodo className="mx-auto size-8 text-muted-foreground/60" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">No tasks yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add one manually or describe it in plain language on the new task page.
            </p>
            <Link href="/tasks/new" className={cn(buttonVariants(), "mt-5 inline-flex")}>
              Create your first task
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {activeTasks.length > 0 ? (
              <TaskList
                tasks={activeTasks}
                onComplete={completeTask}
                onReopen={reopenTask}
                onDelete={deleteTask}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No open tasks — nice work.</p>
            )}

            {completedTasks.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
                <TaskList
                  tasks={completedTasks}
                  onComplete={completeTask}
                  onReopen={reopenTask}
                  onDelete={deleteTask}
                />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
