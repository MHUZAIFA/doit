"use client"

import Link from "next/link"
import { scheduleTaskIdToString } from "@/lib/schedule-task-id"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type ScheduleOptionView = {
  optionId: string
  score: number
  tasks: Array<{ taskId: string; startTime: string; endTime: string }>
}

const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }

function formatDuration(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rm = m % 60
  if (rm === 0) return `${h} hr`
  return `${h} hr ${rm} min`
}

export function ScheduleOptionCards({
  options,
  taskTitles,
}: {
  options: ScheduleOptionView[]
  taskTitles: Record<string, string>
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">No plan for this day. Choose a date and generate.</p>
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {options.map((opt, idx) => (
        <Card
          key={opt.optionId}
          className={cn(
            "h-full shadow-none",
            idx === 0 && "ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
          )}
        >
          <CardHeader className="border-b border-border/80 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base font-medium tracking-tight">
                    {idx === 0 ? "Primary plan" : `Option ${idx + 1}`}
                  </CardTitle>
                  {idx === 0 ? (
                    <Badge variant="default" className="font-medium">
                      Best match
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {idx === 0 ? "Suggested order for the day" : "Another viable ordering"}
                </p>
              </div>
              <span
                className="shrink-0 text-xs tabular-nums text-muted-foreground"
                title="Planner score for this ordering"
              >
                Score {Math.round(opt.score)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <ol className="m-0 list-none space-y-0 p-0">
              {opt.tasks.map((slot) => {
                const taskId = scheduleTaskIdToString(slot.taskId as unknown)
                const start = new Date(slot.startTime)
                const end = new Date(slot.endTime)
                const label = (taskId && taskTitles[taskId]) || "Task"
                const durationMs = end.getTime() - start.getTime()

                const block = (
                  <>
                    <div className="font-medium leading-snug text-foreground">{label}</div>
                    <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                      {formatDuration(durationMs)}
                    </div>
                  </>
                )

                return (
                  <li
                    key={`${opt.optionId}-${taskId || slot.startTime}-${slot.startTime}`}
                    className="flex gap-3 pb-6 last:pb-0"
                  >
                    <div className="w-13 shrink-0 text-right">
                      <div className="text-xs font-medium tabular-nums leading-none text-foreground">
                        {start.toLocaleTimeString([], timeOpts)}
                      </div>
                      <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        {end.toLocaleTimeString([], timeOpts)}
                      </div>
                    </div>
                    <div className="relative min-w-0 flex-1 border-l border-border pl-4 pt-0.5">
                      <span
                        className="absolute left-0 top-2 size-2.5 -translate-x-1/2 rounded-full border-2 border-card bg-primary"
                        aria-hidden
                      />
                      {taskId ? (
                        <Link
                          href={`/tasks/${taskId}/edit`}
                          className="block rounded-md outline-none ring-offset-background transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {block}
                        </Link>
                      ) : (
                        block
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
