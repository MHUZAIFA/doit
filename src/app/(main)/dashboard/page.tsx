"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { TaskCard, type TaskView } from "@/components/task-card"
import { ScheduleTimeline, type TimelineBlock } from "@/components/timeline"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localDateInputValue } from "@/lib/date"
import { cn } from "@/lib/utils"

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
  const [privacyLoading, setPrivacyLoading] = useState(false)

  const today = useMemo(() => localDateInputValue(), [])

  const load = useCallback(async () => {
    const [meR, tasksR, schR, insR] = await Promise.all([
      fetch("/api/auth/me").then((r) => r.json() as Promise<Me>),
      fetch("/api/tasks").then((r) => r.json() as Promise<{ tasks: TaskView[] }>),
      fetch(`/api/schedules?date=${today}`).then((r) => r.json() as Promise<ScheduleRes>),
      fetch("/api/ai/insights").then(async (r) => {
        if (!r.ok) return null
        return r.json() as Promise<{ insights?: InsightsPayload }>
      }),
    ])
    setMe(meR.user)
    setTasks(tasksR.tasks ?? [])
    setSchedule(schR.schedule)
    if (insR && "insights" in insR && insR.insights) {
      setInsights(insR.insights)
    }
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {me ? `Hi, ${me.name}` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            {today} · Your schedule, tasks, and streaks in one place.
          </p>
        </div>
        <Link href="/tasks/new" className={cn(buttonVariants())}>
          New task
        </Link>
      </div>

      {me && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Streak</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {me.gamification.streak} days
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Productivity</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {me.gamification.productivityScore}
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Done</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {me.gamification.tasksCompleted}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="privacy"
            checked={Boolean(me?.preferences.privacyMode)}
            disabled={privacyLoading || !me}
            onCheckedChange={(v) => togglePrivacy(v === true)}
          />
          <Label htmlFor="privacy" className="text-sm font-normal">
            Privacy mode (skip external AI, encrypt titles when key is set)
          </Label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScheduleTimeline blocks={blocks} />
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base">AI insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {insights ? (
              <>
                <p>{insights.productivityPattern}</p>
                <ul className="list-inside list-disc">
                  {insights.commonDelays.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={async () => {
                    await fetch("/api/ai/insights", { method: "POST" })
                    load()
                  }}
                >
                  Refresh insights
                </Button>
              </>
            ) : (
              <p>Loading…</p>
            )}
          </CardContent>
        </Card>
      </div>

      {schedule?.alerts?.length ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {schedule.alerts.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Tasks</h2>
          <Link href="/schedule" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            AI schedules
          </Link>
        </div>
        <Separator className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet. Create one to get started.</p>
          ) : (
            tasks.map((t) => (
              <TaskCard key={t.id} task={t} onComplete={completeTask} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
