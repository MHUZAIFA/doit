"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ListTodo, Plus } from "lucide-react"
import { toast } from "sonner"

import { type TaskView } from "@/components/task-card"
import { TaskList } from "@/components/task-list-row"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskView[]>([])

  const load = useCallback(async () => {
    const r = await fetch("/api/tasks")
    const data = (await r.json()) as { tasks?: TaskView[] }
    setTasks(data.tasks ?? [])
  }, [])

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

  const { activeTasks, completedTasks } = useMemo(() => {
    const active: TaskView[] = []
    const done: TaskView[] = []
    for (const t of tasks) {
      if (t.status === "completed") done.push(t)
      else active.push(t)
    }
    return { activeTasks: active, completedTasks: done }
  }, [tasks])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "inline-flex w-fit gap-1.5 px-0 text-muted-foreground"
            )}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Dashboard
          </Link>
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">All tasks</h1>
            <span className="text-sm tabular-nums text-muted-foreground">
              {activeTasks.length} open
              {completedTasks.length > 0 ? ` · ${completedTasks.length} done` : ""}
            </span>
          </div>
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

      {tasks.length === 0 ? (
        <div className="rounded-[var(--radius-xs)] border-2 border-dashed border-border px-6 py-12 text-center dark:border-white/15">
          <ListTodo className="mx-auto size-8 text-muted-foreground/60" aria-hidden />
          <p className="mt-3 text-sm font-medium text-foreground">No tasks yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a task to see it listed here.</p>
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
              <h2 className="text-sm font-medium text-muted-foreground">Completed</h2>
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
    </div>
  )
}
