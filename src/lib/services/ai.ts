export type ParsedTaskFields = {
  title: string
  description?: string
  category: string
  locationName?: string
  durationMinutes: number
  deadlineIso?: string | null
  priority: "low" | "medium" | "high"
  constraints?: Record<string, unknown>
}

const SYSTEM_PARSE = `You are a scheduling assistant. Extract structured task data from natural language.
Respond with ONLY valid JSON (no markdown) matching this shape:
{
  "title": string,
  "description"?: string,
  "category": string (work|personal|health|errand|other),
  "locationName"?: string,
  "durationMinutes": number (default 60),
  "deadlineIso"?: string | null (ISO 8601 if mentioned),
  "priority": "low"|"medium"|"high",
  "constraints"?: object (e.g. businessHoursOnly, needsGoodWeather)
}`

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
    const err = await res.text()
    throw new Error(`AI API error ${res.status}: ${err}`)
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

export async function parseTaskFromNaturalLanguage(
  text: string,
  opts?: { privacyMode?: boolean }
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

  const grokKey = process.env.XAI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (grokKey) {
    const raw = await callChatCompletions(
      "https://api.x.ai/v1",
      grokKey,
      process.env.XAI_MODEL ?? "grok-2-latest",
      [
        { role: "system", content: SYSTEM_PARSE },
        { role: "user", content: text },
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
        { role: "user", content: text },
      ]
    )
    return parseJsonFromModel(raw)
  }

  const title = text.slice(0, 120).trim() || "New task"
  return {
    title,
    category: "other",
    durationMinutes: 60,
    deadlineIso: null,
    priority: "medium",
    constraints: { fallback: true, note: "Configure XAI_API_KEY or OPENAI_API_KEY for NLP" },
  }
}

export async function summarizeSchedulingContext(prompt: string): Promise<string> {
  const grokKey = process.env.XAI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  if (!grokKey && !openaiKey) {
    return "AI keys not configured. Showing rule-based schedule only."
  }
  try {
    const raw = await callChatCompletions(
      grokKey ? "https://api.x.ai/v1" : "https://api.openai.com/v1",
      (grokKey ?? openaiKey) as string,
      grokKey ? (process.env.XAI_MODEL ?? "grok-2-latest") : (process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      [
        {
          role: "system",
          content:
            "You are the AI assistant inside the Done. app (the product name includes the period). Be concise; reply in under 120 words with actionable scheduling advice.",
        },
        { role: "user", content: prompt },
      ]
    )
    return raw
  } catch (e) {
    return e instanceof Error ? e.message : "AI unavailable"
  }
}
