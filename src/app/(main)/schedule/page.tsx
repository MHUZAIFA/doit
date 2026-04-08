"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { ScheduleOptionCards, type ScheduleOptionView } from "@/components/schedule-option-cards"
import { ScheduleUpNext } from "@/components/schedule-up-next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { localDateInputValue } from "@/lib/date"
import { cn } from "@/lib/utils"

type TaskView = { id: string; title: string; status: string }

type ScheduleApi = {
  schedule: {
    scheduleOptions: ScheduleOptionView[]
    alerts: string[]
    aiSummary?: string | null
  } | null
}

export default function SchedulePage() {
  const [date, setDate] = useState(() => localDateInputValue())
  const [options, setOptions] = useState<ScheduleOptionView[]>([])
  const [alerts, setAlerts] = useState<string[]>([])
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [tasks, setTasks] = useState<TaskView[]>([])
  const [fetching, setFetching] = useState(true)
  const [generating, setGenerating] = useState(false)

  const titles = useMemo(
    () => Object.fromEntries(tasks.map((t) => [t.id, t.title])),
    [tasks]
  )

  const refresh = useCallback(async () => {
    setFetching(true)
    setOptions([])
    setAlerts([])
    setAiSummary(null)
    try {
      const [schR, tskR] = await Promise.all([
        fetch(`/api/schedules?date=${date}`, { credentials: "same-origin" }).then((r) =>
          r.json() as Promise<ScheduleApi>
        ),
        fetch("/api/tasks", { credentials: "same-origin" }).then((r) =>
          r.json() as Promise<{ tasks: TaskView[] }>
        ),
      ])
      setTasks(tskR.tasks ?? [])
      if (schR.schedule) {
        setOptions(schR.schedule.scheduleOptions ?? [])
        setAlerts(schR.schedule.alerts ?? [])
        setAiSummary(schR.schedule.aiSummary ?? null)
      }
    } catch {
      toast.error("Could not load schedule")
    } finally {
      setFetching(false)
    }
  }, [date])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function generate() {
    setGenerating(true)
    try {
      const cal = localDateInputValue()
      const clientTimeZone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined
      const res = await fetch("/api/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          date,
          fromNow: date === cal,
          clientCalendarDate: cal,
          ...(clientTimeZone ? { clientTimeZone } : {}),
        }),
      })
      const data = (await res.json()) as ScheduleApi & { error?: unknown }
      if (!res.ok) {
        toast.error("Could not generate schedule")
        return
      }
      setOptions(data.schedule?.scheduleOptions ?? [])
      setAlerts(data.schedule?.alerts ?? [])
      setAiSummary(data.schedule?.aiSummary ?? null)
      const tasksRes = await fetch("/api/tasks", { credentials: "same-origin" })
      if (tasksRes.ok) {
        const body = (await tasksRes.json()) as { tasks?: TaskView[] }
        setTasks(body.tasks ?? [])
      }
      const optCount = data.schedule?.scheduleOptions?.length ?? 0
      if (optCount === 0 && (data.schedule?.alerts?.length ?? 0) === 0) {
        toast.message("No options for this day.")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="w-full space-y-8 pb-8 pt-2">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="min-w-0 space-y-1">
          <Link
            href="/dashboard"
            className="inline-block text-[13px] text-muted-foreground hover:text-foreground"
          >
            Dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="schedule-date" className="text-xs text-muted-foreground">
              Day
            </Label>
            <Input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-46"
            />
          </div>
          <Button
            type="button"
            className="h-10"
            onClick={() => void generate()}
            disabled={generating || fetching}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Generating
              </>
            ) : (
              "Generate plan"
            )}
          </Button>
        </div>
      </div>

      {alerts.length > 0 ? (
        <ul
          className="space-y-1 border-l-2 border-amber-500/60 pl-3 text-sm text-amber-950 dark:border-amber-400/50 dark:text-amber-100/95"
          role="status"
        >
          {alerts.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      ) : null}

      <ScheduleUpNext primaryOption={options[0]} taskTitles={titles} scheduleDate={date} />

      {aiSummary ? (
        <p className="max-w-4xl text-pretty text-sm leading-relaxed text-muted-foreground">
          {aiSummary}
        </p>
      ) : null}

      <div className={cn((fetching || generating) && options.length === 0 && "min-h-16")}>
        {fetching && options.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : generating && options.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            Generating…
          </p>
        ) : (
          <ScheduleOptionCards options={options} taskTitles={titles} />
        )}
      </div>

      {!fetching && !generating && options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Need tasks?{" "}
          <Link href="/tasks/new" className="text-foreground underline-offset-4 hover:underline">
            Add one
          </Link>
          {" · "}
          <Link href="/tasks" className="text-foreground underline-offset-4 hover:underline">
            View all
          </Link>
        </p>
      ) : null}
    </div>
  )
}
