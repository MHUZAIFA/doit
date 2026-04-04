"use client"

import dynamic from "next/dynamic"

const EditTaskClient = dynamic(() => import("./edit-task-client"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full max-w-none space-y-6 pb-8"
      aria-busy="true"
      aria-label="Loading task"
    >
      <div className="space-y-2">
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="h-9 w-48 max-w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted" />
      </div>
      <div className="h-24 w-full animate-pulse rounded-lg bg-muted/80" />
      <div className="space-y-4">
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-20 w-full animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-16 animate-pulse rounded-md bg-muted" />
          <div className="h-16 animate-pulse rounded-md bg-muted" />
          <div className="h-16 animate-pulse rounded-md bg-muted" />
          <div className="h-16 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted/80" />
        <div className="h-11 w-full animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  ),
})

export default function EditTaskDynamic({ taskId }: { taskId: string }) {
  return <EditTaskClient taskId={taskId} />
}
