import { textImpliesClearForm } from "@/lib/task-parse-utils"

export type ParsedTaskFields = {
  /** When true, discard all form fields and start fresh. */
  clearForm?: boolean
  title: string
  description?: string
  category: string
  locationName?: string
  durationMinutes: number
  deadlineIso?: string | null
  priority: "low" | "medium" | "high"
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

Merge rules:
- Preserve existing field values unless the user changes them, adds detail, or clearly contradicts.
- Only update fields the user mentions or clearly implies.
- If the user asks to clear, reset, empty, or wipe the form (e.g. "clear form", "start over", "reset everything"), set "clearForm": true. Do not merge in that case.

Respond with ONLY valid JSON (no markdown) matching this shape:
{
  "clearForm"?: boolean,
  "title": string,
  "description"?: string,
  "category": string (work|personal|health|errand|other),
  "locationName"?: string,
  "durationMinutes": number (default 60),
  "deadlineIso"?: string | null (ISO 8601 if mentioned),
  "priority": "low"|"medium"|"high",
  "constraints"?: object
}

When "clearForm" is true, you may use empty strings and defaults; title may be "".
When "clearForm" is false or omitted, "title" must be a non-empty string.`

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

function parseJsonFromModel(text: string): ParsedTaskFields {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
  const parsed = JSON.parse(cleaned) as ParsedTaskFields
  if (parsed.clearForm === true) {
    return {
      clearForm: true,
      title: "",
      description: undefined,
      category: "other",
      locationName: undefined,
      durationMinutes: 60,
      deadlineIso: null,
      priority: "medium",
      constraints: parsed.constraints,
    }
  }
  if (!parsed.title || typeof parsed.title !== "string") {
    throw new Error("Invalid parse: missing title")
  }
  return {
    title: parsed.title,
    description: parsed.description,
    category: parsed.category || "other",
    locationName: parsed.locationName,
    durationMinutes: Math.max(15, Math.min(24 * 60, Number(parsed.durationMinutes) || 60)),
    deadlineIso: parsed.deadlineIso ?? null,
    priority: parsed.priority || "medium",
    constraints: parsed.constraints,
  }
}

function buildParseUserContent(
  text: string,
  currentForm?: Record<string, unknown> | null
): string {
  if (!currentForm || Object.keys(currentForm).length === 0) return text
  return `Current form (merge with the user's message; only change what they mention or imply):\n${JSON.stringify(currentForm, null, 2)}\n\nUser message:\n${text}`
}

export async function parseTaskFromNaturalLanguage(
  text: string,
  opts?: { privacyMode?: boolean; currentForm?: Record<string, unknown> | null }
): Promise<ParsedTaskFields> {
  if (opts?.privacyMode) {
    return {
      title: "Private task",
      description: undefined,
      category: "other",
      durationMinutes: 60,
      deadlineIso: null,
      priority: "medium",
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
      title: "",
      description: undefined,
      category: "other",
      durationMinutes: 60,
      deadlineIso: null,
      priority: "medium",
      constraints: { fallback: true },
    }
  }

  const title = text.slice(0, 120).trim() || "New task"
  return {
    title,
    category: "other",
    durationMinutes: 60,
    deadlineIso: null,
    priority: "medium",
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
