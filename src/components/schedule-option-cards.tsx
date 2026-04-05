"use client"

import { scheduleTaskIdToString } from "@/lib/schedule-task-id"
import { cn } from "@/lib/utils"

export type ScheduleOptionView = {
  optionId: string
  score: number
  tasks: Array<{ taskId: string; startTime: string; endTime: string }>
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
    <div className="grid gap-6 md:grid-cols-3">
      {options.map((opt, idx) => (
        <div
          key={opt.optionId}
          className={cn(
            "border-t border-border pt-4 first:border-t-0 first:pt-0 md:border-t-0 md:pt-0 md:border-l md:pl-6 md:first:border-l-0 md:first:pl-0",
            idx === 0 && "md:pr-2"
          )}
        >
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">
              {idx === 0 ? "Best fit" : `Option ${idx + 1}`}
            </h2>
            <span className="tabular-nums text-xs text-muted-foreground">{Math.round(opt.score)}</span>
          </div>
          <ul className="space-y-3 text-sm">
            {opt.tasks.map((slot) => {
              const taskId = scheduleTaskIdToString(slot.taskId as unknown)
              const start = new Date(slot.startTime)
              const end = new Date(slot.endTime)
              const label = (taskId && taskTitles[taskId]) || "Task"
              return (
                <li key={`${opt.optionId}-${taskId || slot.startTime}-${slot.startTime}`}>
                  <div className="font-medium leading-snug text-foreground">{label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
