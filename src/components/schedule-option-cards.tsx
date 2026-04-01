"use client"

import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
    return (
      <p className="text-sm text-muted-foreground">
        No schedule options yet. Generate a schedule from the button above.
      </p>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {options.map((opt, idx) => (
        <Card
          key={opt.optionId}
          className={cn(idx === 0 && "ring-2 ring-primary/30")}
          size="sm"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-semibold">Option {idx + 1}</CardTitle>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="size-3" />
              {Math.round(opt.score)}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {opt.tasks.map((slot) => (
              <div
                key={`${opt.optionId}-${slot.taskId}-${slot.startTime}`}
                className="rounded-md border bg-muted/30 px-2 py-1.5"
              >
                <div className="font-medium text-foreground">
                  {taskTitles[slot.taskId] ?? slot.taskId}
                </div>
                <div className="text-muted-foreground">
                  {new Date(slot.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  –{" "}
                  {new Date(slot.endTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
