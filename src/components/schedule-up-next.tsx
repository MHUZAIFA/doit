"use client"

import Link from "next/link"
import { Zap } from "lucide-react"

import type { ScheduleOptionView } from "@/components/schedule-option-cards"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localDateInputValue } from "@/lib/date"

const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }

export function ScheduleUpNext({
  primaryOption,
  taskTitles,
  scheduleDate,
}: {
  primaryOption: ScheduleOptionView | undefined
  taskTitles: Record<string, string>
  scheduleDate: string
}) {
  const isToday = scheduleDate === localDateInputValue()
  if (!isToday || !primaryOption?.tasks?.length) return null

  const upNext = primaryOption.tasks.slice(0, 8)

  return (
    <Card className="border-primary/25 bg-primary/3 shadow-none dark:bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Zap className="size-4 text-primary" aria-hidden />
          Up next
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          First tasks from your primary plan — tackle these in order when you&apos;re ready.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {upNext.map((slot, i) => {
            const title = taskTitles[slot.taskId] || "Task"
            const start = new Date(slot.startTime)
            const end = new Date(slot.endTime)
            return (
              <li key={`${slot.taskId}-${slot.startTime}`} className="flex gap-3 text-sm">
                <span className="w-7 shrink-0 font-medium tabular-nums text-muted-foreground">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tasks/${slot.taskId}/edit`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {title}
                  </Link>
                  <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {start.toLocaleTimeString([], timeOpts)} – {end.toLocaleTimeString([], timeOpts)}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
