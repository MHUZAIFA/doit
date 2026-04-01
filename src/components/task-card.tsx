"use client"

import { Calendar, Clock, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type TaskView = {
  id: string
  title: string
  category: string
  location: { name: string }
  durationMinutes: number
  deadline: string | null
  priority: string
  status: string
}

const priorityVariant: Record<string, "default" | "secondary" | "destructive"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
}

export function TaskCard({
  task,
  onComplete,
  className,
}: {
  task: TaskView
  onComplete?: (id: string) => void
  className?: string
}) {
  return (
    <Card size="sm" className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">{task.title}</CardTitle>
          <Badge variant={priorityVariant[task.priority] ?? "secondary"}>{task.priority}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{task.category}</Badge>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {task.durationMinutes} min
          </span>
        </div>
        {task.deadline && (
          <div className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            {new Date(task.deadline).toLocaleString()}
          </div>
        )}
        {task.location.name && (
          <div className="flex items-center gap-1">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{task.location.name}</span>
          </div>
        )}
      </CardContent>
      {task.status !== "completed" && onComplete && (
        <CardFooter className="border-t pt-3">
          <Button size="sm" variant="secondary" onClick={() => onComplete(task.id)}>
            Mark done
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
