"use client"

import { Calendar, Clock, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { categoryBadgeClass, priorityBadgeVariant } from "@/lib/task-badges"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

export type TaskView = {
  id: string
  title: string
  description?: string | null
  category: string
  location: { name: string }
  durationMinutes: number
  deadline: string | null
  priority: string
  status: string
}

export function TaskCard({
  task,
  onComplete,
  onReopen,
  className,
}: {
  task: TaskView
  onComplete?: (id: string) => void
  onReopen?: (id: string) => void
  className?: string
}) {
  const done = task.status === "completed"

  return (
    <Card size="sm" className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          {onComplete || onReopen ? (
            <div className="flex shrink-0 items-center">
              <Checkbox
                checked={done}
                disabled={(done && !onReopen) || (!done && !onComplete)}
                onCheckedChange={(v) => {
                  if (v === true && !done && onComplete) onComplete(task.id)
                  if (v === false && done && onReopen) onReopen(task.id)
                }}
                aria-label={
                  done ? "Reopen task (mark not complete)" : "Mark complete"
                }
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{task.title}</CardTitle>
              <Badge
                variant={priorityBadgeVariant(task.priority)}
                className={cn("capitalize", done && "opacity-70")}
              >
                {task.priority}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge
            variant="outline"
            className={cn(categoryBadgeClass(task.category), done && "opacity-70")}
          >
            {task.category}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden />
            {task.durationMinutes} min
          </span>
          {task.deadline ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
              Due {new Date(task.deadline).toLocaleString()}
            </span>
          ) : null}
        </div>
        {task.location.name ? (
          <div className="flex items-center gap-1">
            <MapPin className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{task.location.name}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
