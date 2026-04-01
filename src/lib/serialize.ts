import { decryptSensitiveText } from "@/lib/services/privacy"
import type { TaskDocument } from "@/lib/models"

export function serializeTask(doc: TaskDocument, maskPrivate = false) {
  let title = doc.title
  if (doc.encryptedPayload && !maskPrivate) {
    const dec = decryptSensitiveText(doc.encryptedPayload)
    if (dec) title = dec
  } else if (doc.encryptedPayload && maskPrivate) {
    title = "Private task"
  }

  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    title,
    description: doc.description,
    category: doc.category,
    location: doc.location,
    durationMinutes: doc.durationMinutes,
    deadline: doc.deadline?.toISOString() ?? null,
    priority: doc.priority,
    constraints: doc.constraints,
    status: doc.status,
    isEncrypted: Boolean(doc.encryptedPayload),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}
