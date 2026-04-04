"use client"

import TaskEditorClient from "../../task-editor-client"

export default function EditTaskClient({ taskId }: { taskId: string }) {
  return <TaskEditorClient mode="edit" taskId={taskId} />
}
