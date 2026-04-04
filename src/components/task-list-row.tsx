"use client"

import { useCallback, useRef, useState } from "react"
import { Calendar, Clock, MapPin, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { TaskView } from "@/components/task-card"
import { categoryBadgeClass, priorityBadgeVariant } from "@/lib/task-badges"
import { cn } from "@/lib/utils"

const SWIPE_THRESHOLD_PX = 64
const MAX_SWIPE_PX = 96

function clampSwipe(dx: number) {
  return Math.max(-MAX_SWIPE_PX, Math.min(MAX_SWIPE_PX, dx))
}

export function TaskListRow({
  task,
  onComplete,
  onReopen,
  onDelete,
  className,
}: {
  task: TaskView
  onComplete?: (id: string) => void
  onReopen?: (id: string) => void
  onDelete?: (id: string) => void
  className?: string
}) {
  const done = task.status === "completed"
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ pointerId: number; startX: number } | null>(null)

  const finishDrag = useCallback(
    (clientX: number, releaseTarget: HTMLElement | null, pointerId: number) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== pointerId) return

      if (releaseTarget) {
        try {
          releaseTarget.releasePointerCapture(pointerId)
        } catch {
          /* already released */
        }
      }

      const final = clampSwipe(clientX - drag.startX)
      dragRef.current = null
      setIsDragging(false)

      if (final >= SWIPE_THRESHOLD_PX) {
        if (!done && onComplete) {
          onComplete(task.id)
        } else if (done && onReopen) {
          onReopen(task.id)
        }
      } else if (final <= -SWIPE_THRESHOLD_PX && onDelete) {
        onDelete(task.id)
      }
      setOffset(0)
    },
    [done, onComplete, onReopen, onDelete, task.id]
  )

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (
      t.closest(
        'button, a, [role="button"], [role="checkbox"], [data-slot="checkbox"]'
      )
    )
      return

    dragRef.current = { pointerId: e.pointerId, startX: e.clientX }
    setIsDragging(true)
    setOffset(0)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    setOffset(clampSwipe(e.clientX - drag.startX))
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finishDrag(e.clientX, e.currentTarget, e.pointerId)
    },
    [finishDrag]
  )

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* */
      }
      dragRef.current = null
      setIsDragging(false)
      setOffset(0)
    },
    []
  )

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xs border-2 border-border bg-background dark:border-white/10",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 flex"
        aria-hidden
      >
        <div
          className={cn(
            "flex w-[min(28%,96px)] shrink-0 items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-white",
            done
              ? "bg-violet-600 dark:bg-violet-500"
              : "bg-emerald-600 dark:bg-emerald-700"
          )}
        >
          {done ? "Reopen" : "Done"}
        </div>
        <div className="min-w-0 flex-1 bg-muted/40" />
        <div className="flex w-[min(28%,96px)] shrink-0 items-center justify-center bg-destructive text-[11px] font-semibold uppercase tracking-wide text-destructive-foreground">
          Delete
        </div>
      </div>

      <div
        className={cn(
          "relative touch-pan-y border-b border-border bg-background py-3 pl-3 pr-3 sm:pl-4 sm:pr-4 dark:border-white/10",
          !isDragging && "transition-[transform] duration-200 ease-out"
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex shrink-0 items-center">
              {onComplete || onReopen ? (
                <Checkbox
                  checked={done}
                  disabled={
                    (done && !onReopen) || (!done && !onComplete)
                  }
                  onCheckedChange={(v) => {
                    if (v === true && !done && onComplete) onComplete(task.id)
                    if (v === false && done && onReopen) onReopen(task.id)
                  }}
                  aria-label={
                    done ? "Reopen task (mark not complete)" : "Mark complete"
                  }
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
            <p
              className={cn(
                "text-[15px] font-medium leading-snug",
                done && "text-muted-foreground line-through decoration-muted-foreground/60"
              )}
            >
              {task.title}
            </p>
            {task.description?.trim() ? (
              <p
                className={cn(
                  "line-clamp-3 whitespace-pre-line wrap-break-word text-[13px] leading-relaxed text-muted-foreground",
                  done && "text-muted-foreground/75"
                )}
              >
                {task.description.trim()}
              </p>
            ) : null}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-snug text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden />
                {task.durationMinutes} min
              </span>
              {task.deadline ? (
                <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground/90">
                  <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  Due {new Date(task.deadline).toLocaleString()}
                </span>
              ) : null}
              <Badge
                variant="outline"
                className={cn(categoryBadgeClass(task.category), done && "opacity-70")}
              >
                {task.category}
              </Badge>
              <Badge
                variant={priorityBadgeVariant(task.priority)}
                className={cn("capitalize", done && "opacity-70")}
              >
                {task.priority}
              </Badge>
            </p>
            {task.location.name ? (
              <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <MapPin className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 wrap-break-word">{task.location.name}</span>
              </p>
            ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onDelete ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete task"
                onClick={() => onDelete(task.id)}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground/80 sm:hidden">
          {done
            ? "Swipe right to reopen, left to delete."
            : "Swipe right to mark done, left to delete."}
        </p>
      </div>
    </li>
  )
}

export function TaskList({
  tasks,
  onComplete,
  onReopen,
  onDelete,
  className,
}: {
  tasks: TaskView[]
  onComplete?: (id: string) => void
  onReopen?: (id: string) => void
  onDelete?: (id: string) => void
  className?: string
}) {
  return (
    <ul className={cn("list-none flex flex-col gap-3", className)}>
      {tasks.map((t) => (
        <TaskListRow
          key={t.id}
          task={t}
          onComplete={onComplete}
          onReopen={onReopen}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
