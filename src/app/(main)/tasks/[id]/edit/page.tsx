import EditTaskDynamic from "./edit-task-dynamic"

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EditTaskDynamic taskId={id} />
}
