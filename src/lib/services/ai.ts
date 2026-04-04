import {
  normalizeLocationLabelField,
  normalizeTaskDescriptionField,
  normalizeTaskTitleField,
} from "@/lib/ai-text-normalize"
import { textImpliesClearForm } from "@/lib/task-parse-utils"

/** Fields the model intends to change; omit keys that should stay as-is on the form. */
export type TaskFormUpdates = {
  title?: string
  description?: string
  category?: string
  locationName?: string
  durationMinutes?: number
  deadlineIso?: string | null
  priority?: "low" | "medium" | "high"
}

/** Result of parsing natural language into task form changes. */
export type ParsedTaskFields = {
  /** When true, discard all form fields and start fresh. */
  clearForm?: boolean
  /**
   * Only keys present here replace the corresponding form field. Missing keys leave the UI unchanged.
   * When there is no existing form snapshot, include every field needed for a coherent task (at least `title`).
   */
  updates: TaskFormUpdates
  constraints?: Record<string, unknown>
}

/** Default Grok id for chat completions. `grok-2-*` names are no longer valid — see https://docs.x.ai/docs/models */
const DEFAULT_XAI_MODEL = "grok-4-1-fast-non-reasoning"

/** Groq OpenAI-compatible API — https://console.groq.com/docs/models */
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

const GROQ_BASE = "https://api.groq.com/openai/v1"

/** xAI keys from console.x.ai usually start with `xai-`. `gsk_` keys are Groq — use Groq endpoint, not api.x.ai. */
function resolveXaiKey(): string | undefined {
  const k = process.env.XAI_API_KEY?.trim()
  if (!k || k.startsWith("gsk_")) return undefined
  return k
}

/** Prefer `GROQ_API_KEY`; also accept a `gsk_` key mistakenly placed in `XAI_API_KEY`. */
function resolveGroqKey(): string | undefined {
  const g = process.env.GROQ_API_KEY?.trim()
  if (g) return g
  const misplaced = process.env.XAI_API_KEY?.trim()
  if (misplaced?.startsWith("gsk_")) return misplaced
  return undefined
}

const SYSTEM_PARSE = `You are a scheduling assistant. You may receive a JSON snapshot of the CURRENT FORM plus a user message.

Your job is to return ONLY the fields the user actually wants to change — not a full form copy.

Rules:
1. Respond with JSON containing an "updates" object. Put a field in "updates" ONLY if the user asked to change it, added new information for it, or clearly implied a new value for that field.
2. If the user mentions one thing (e.g. "make it high priority", "deadline Friday 5pm", "rename to Buy milk"), include ONLY the key(s) for that — e.g. {"priority":"high"} or {"deadlineIso":"..."} or {"title":"Buy milk"}.
3. If the user describes a whole new task with no prior form (or asks to replace everything), include every relevant key in "updates" (at least "title" for a new task).
4. If the user adds detail to one area (e.g. longer notes), you may include only "description" or only "title" as appropriate.
5. Do NOT echo unchanged values into "updates" just to repeat the current form. Omit keys that should stay the same.
6. If the user asks to clear, reset, empty, or wipe the form (e.g. "clear form", "start over"), set "clearForm": true and use "updates": {}.
7. For deadline: use "deadlineIso" as ISO 8601 string, or null to clear the deadline if they ask to remove it.
8. category must be one of: work, personal, health, errand, education, other (only include "category" in updates when it should change).
9. durationMinutes: integer minutes, minimum 15 (only when the user mentions duration or time length for the task).
10. In title, description, and locationName strings, use normal English capitalization and punctuation (sentence case, periods where appropriate).

Respond with ONLY valid JSON (no markdown), shape:
{
  "clearForm"?: boolean,
  "updates": {
    "title"?: string,
    "description"?: string,
    "category"?: string,
    "locationName"?: string,
    "durationMinutes"?: number,
    "deadlineIso"?: string | null,
    "priority"?: "low"|"medium"|"high"
  },
  "constraints"?: object
}

When "clearForm" is true, "updates" may be {}.
When there is NO current form and the user describes a new task, "updates" must include at least "title" (non-empty string).`

async function callChatCompletions(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  })
  if (!res.ok) {
    const raw = await res.text()
    let detail = raw
    try {
      const j = JSON.parse(raw) as { error?: { message?: string; code?: string } }
      if (j.error?.message) detail = j.error.message
    } catch {
      /* keep raw */
    }
    throw new Error(`AI API error ${res.status}: ${detail}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("Empty AI response")
  return content.trim()
}

const CATEGORY_SET = new Set(["work", "personal", "health", "errand", "education", "other"])

function clampDuration(n: number): number {
  return Math.max(15, Math.min(24 * 60, n))
}

function normalizeUpdates(raw: Record<string, unknown>): TaskFormUpdates {
  const u: TaskFormUpdates = {}
  if (typeof raw.title === "string") u.title = normalizeTaskTitleField(raw.title)
  if (typeof raw.description === "string") u.description = normalizeTaskDescriptionField(raw.description)
  if (typeof raw.category === "string" && CATEGORY_SET.has(raw.category)) u.category = raw.category
  if (typeof raw.locationName === "string") u.locationName = normalizeLocationLabelField(raw.locationName)
  if (raw.durationMinutes != null && Number.isFinite(Number(raw.durationMinutes))) {
    u.durationMinutes = clampDuration(Number(raw.durationMinutes))
  }
  if (raw.deadlineIso === null) u.deadlineIso = null
  else if (typeof raw.deadlineIso === "string") u.deadlineIso = raw.deadlineIso
  if (raw.priority === "low" || raw.priority === "medium" || raw.priority === "high") {
    u.priority = raw.priority
  }
  return u
}

/** Legacy API shape (full flat object) — treat as full updates. */
function legacyFlatToUpdates(parsed: Record<string, unknown>): TaskFormUpdates {
  const u: TaskFormUpdates = {}
  if (typeof parsed.title === "string") u.title = normalizeTaskTitleField(parsed.title)
  if (typeof parsed.description === "string") u.description = normalizeTaskDescriptionField(parsed.description)
  if (typeof parsed.category === "string" && CATEGORY_SET.has(parsed.category)) u.category = parsed.category
  if (typeof parsed.locationName === "string") u.locationName = normalizeLocationLabelField(parsed.locationName)
  if (parsed.durationMinutes != null && Number.isFinite(Number(parsed.durationMinutes))) {
    u.durationMinutes = clampDuration(Number(parsed.durationMinutes))
  }
  if (parsed.deadlineIso === null) u.deadlineIso = null
  else if (typeof parsed.deadlineIso === "string") u.deadlineIso = parsed.deadlineIso
  if (parsed.priority === "low" || parsed.priority === "medium" || parsed.priority === "high") {
    u.priority = parsed.priority
  }
  return u
}

function parseJsonFromModel(text: string): ParsedTaskFields {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
  const parsed = JSON.parse(cleaned) as Record<string, unknown>

  const constraints =
    parsed.constraints && typeof parsed.constraints === "object" && !Array.isArray(parsed.constraints)
      ? (parsed.constraints as Record<string, unknown>)
      : undefined

  if (parsed.clearForm === true) {
    return { clearForm: true, updates: {}, constraints }
  }

  if (parsed.updates && typeof parsed.updates === "object" && !Array.isArray(parsed.updates)) {
    const updates = normalizeUpdates(parsed.updates as Record<string, unknown>)
    return { updates, constraints }
  }

  // Legacy: model returned flat fields without "updates"
  const updates = legacyFlatToUpdates(parsed)
  return { updates, constraints }
}

function buildParseUserContent(
  text: string,
  currentForm?: Record<string, unknown> | null
): string {
  if (!currentForm || Object.keys(currentForm).length === 0) {
    return `No existing form fields yet. Return an "updates" object with everything needed for this task (at least "title").\n\nUser message:\n${text}`
  }
  return `Current form (JSON below). Return ONLY an "updates" object whose keys are fields the user wants to change — omit keys that should stay unchanged.\n${JSON.stringify(currentForm, null, 2)}\n\nUser message:\n${text}`
}

export async function parseTaskFromNaturalLanguage(
  text: string,
  opts?: { privacyMode?: boolean; currentForm?: Record<string, unknown> | null }
): Promise<ParsedTaskFields> {
  if (opts?.privacyMode) {
    return {
      updates: {
        title: normalizeTaskTitleField("Private task"),
        category: "other",
        durationMinutes: 60,
        deadlineIso: null,
        priority: "medium",
      },
      constraints: { localOnly: true },
    }
  }

  const userContent = buildParseUserContent(text, opts?.currentForm ?? null)

  const xaiKey = resolveXaiKey()
  const groqKey = resolveGroqKey()
  const openaiKey = process.env.OPENAI_API_KEY

  if (xaiKey) {
    const raw = await callChatCompletions(
      "https://api.x.ai/v1",
      xaiKey,
      process.env.XAI_MODEL ?? DEFAULT_XAI_MODEL,
      [
        { role: "system", content: SYSTEM_PARSE },
        { role: "user", content: userContent },
      ]
    )
    return parseJsonFromModel(raw)
  }

  if (groqKey) {
    const raw = await callChatCompletions(
      GROQ_BASE,
      groqKey,
      process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL,
      [
        { role: "system", content: SYSTEM_PARSE },
        { role: "user", content: userContent },
      ]
    )
    return parseJsonFromModel(raw)
  }

  if (openaiKey) {
    const raw = await callChatCompletions(
      "https://api.openai.com/v1",
      openaiKey,
      process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      [
        { role: "system", content: SYSTEM_PARSE },
        { role: "user", content: userContent },
      ]
    )
    return parseJsonFromModel(raw)
  }

  if (textImpliesClearForm(text)) {
    return {
      clearForm: true,
      updates: {},
      constraints: { fallback: true },
    }
  }

  const title = normalizeTaskTitleField(text.slice(0, 120).trim() || "New task")
  return {
    updates: {
      title,
      category: "other",
      durationMinutes: 60,
      deadlineIso: null,
      priority: "medium",
    },
    constraints: {
      fallback: true,
      note: "Configure XAI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY for NLP",
    },
  }
}

export async function summarizeSchedulingContext(prompt: string): Promise<string> {
  const xaiKey = resolveXaiKey()
  const groqKey = resolveGroqKey()
  const openaiKey = process.env.OPENAI_API_KEY
  if (!xaiKey && !groqKey && !openaiKey) {
    return "AI keys not configured. Showing rule-based schedule only."
  }
  try {
    const baseUrl = xaiKey
      ? "https://api.x.ai/v1"
      : groqKey
        ? GROQ_BASE
        : "https://api.openai.com/v1"
    const key = (xaiKey ?? groqKey ?? openaiKey) as string
    const model = xaiKey
      ? (process.env.XAI_MODEL ?? DEFAULT_XAI_MODEL)
      : groqKey
        ? (process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL)
        : (process.env.OPENAI_MODEL ?? "gpt-4o-mini")
    const raw = await callChatCompletions(baseUrl, key, model, [
      {
        role: "system",
        content:
          "You are the AI assistant inside the Done. app (the product name includes the period). Be concise; reply in under 120 words with actionable scheduling advice.",
      },
      { role: "user", content: prompt },
    ])
    return raw
  } catch (e) {
    return e instanceof Error ? e.message : "AI unavailable"
  }
}
