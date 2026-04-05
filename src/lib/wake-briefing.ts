/**
 * After wake music’s ramp window: greeting (includes local temp when available) → pause → task summary →
 * productivity recommendation (what to work on next). Uses the Web Speech API for speech (system voice), not cloud TTS.
 */
import { localDateInputValue } from "@/lib/date"

/** Optional tuning (1 = default). */
const WAKE_SPEECH_RATE = 1
const WAKE_SPEECH_PITCH = 1

const DEFAULT_WAKE_GREETING = "Welcome back sir!"

/** Preference `wakeVoiceNameIncludes`: `""`, or `name|||lang` from the voice picker, or legacy substring. */
function pickWakeVoice(stored: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  const needle = stored.trim()
  if (!needle) {
    return voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? voices[0] ?? null
  }
  const sep = needle.indexOf("|||")
  if (sep !== -1) {
    const name = needle.slice(0, sep)
    const lang = needle.slice(sep + 3)
    return voices.find((v) => v.name === name && v.lang === lang) ?? null
  }
  return (
    voices.find((v) => v.name.toLowerCase().includes(needle.toLowerCase())) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ??
    voices[0] ??
    null
  )
}

async function fetchBriefingPreferences(): Promise<{ voice: string; greeting: string }> {
  try {
    const res = await fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
    })
    const data = (await res.json()) as {
      user?: { preferences?: { wakeVoiceNameIncludes?: string; wakeGreeting?: string } }
    }
    const p = data.user?.preferences
    return {
      voice: typeof p?.wakeVoiceNameIncludes === "string" ? p.wakeVoiceNameIncludes : "",
      greeting:
        typeof p?.wakeGreeting === "string" && p.wakeGreeting.trim()
          ? p.wakeGreeting.trim()
          : DEFAULT_WAKE_GREETING,
    }
  } catch {
    return { voice: "", greeting: DEFAULT_WAKE_GREETING }
  }
}

type TaskRow = {
  title: string
  deadline: string | null
  status: string
  isEncrypted?: boolean
}

let briefingTimer: ReturnType<typeof setTimeout> | null = null

export function cancelScheduledPostWakeBriefing(): void {
  if (briefingTimer) {
    clearTimeout(briefingTimer)
    briefingTimer = null
  }
}

export function schedulePostWakeBriefing(delayMs: number): void {
  cancelScheduledPostWakeBriefing()
  briefingTimer = setTimeout(() => {
    briefingTimer = null
    void runPostWakeBriefing()
  }, delayMs)
}

function speak(text: string, voicePreference: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve()
      return
    }
    const run = () => {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "en-US"
      u.rate = WAKE_SPEECH_RATE
      u.pitch = WAKE_SPEECH_PITCH
      const voice = pickWakeVoice(voicePreference)
      if (voice) u.voice = voice
      u.onend = () => resolve()
      u.onerror = () => resolve()
      window.speechSynthesis.speak(u)
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) {
      let done = false
      const go = () => {
        if (done) return
        done = true
        window.speechSynthesis.removeEventListener("voiceschanged", go)
        clearTimeout(fallback)
        run()
      }
      window.speechSynthesis.addEventListener("voiceschanged", go)
      const fallback = window.setTimeout(go, 3000)
      return
    }
    run()
  })
}

function pauseMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function titleForSpeech(t: TaskRow): string {
  if (t.isEncrypted) return "a private task"
  return t.title || "Untitled task"
}

function buildTodayTasksSummary(tasks: TaskRow[]): string {
  const today = localDateInputValue()
  const pending = tasks.filter((t) => t.status !== "completed")

  if (pending.length === 0) {
    return "You have no pending tasks. You're all caught up for now."
  }

  const dueToday: TaskRow[] = []

  for (const t of pending) {
    if (!t.deadline) continue
    const local = localDateInputValue(new Date(t.deadline))
    if (local === today) dueToday.push(t)
  }

  const parts: string[] = [`You have ${pending.length} pending task${pending.length === 1 ? "" : "s"}.`]

  if (dueToday.length > 0) {
    const names = dueToday.slice(0, 6).map(titleForSpeech)
    const extra = dueToday.length > 6 ? `, and ${dueToday.length - 6} more` : ""
    parts.push(
      `${dueToday.length} ${dueToday.length === 1 ? "is" : "are"} due today: ${names.join(", ")}${extra}.`
    )
  } else {
    parts.push("Nothing is due today.")
  }

  return parts.join(" ")
}

async function coordsFromBrowser(): Promise<{ lat: number; lon: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 }
    )
  })
}

/** Sentence fragment appended after the wake greeting when location + API succeed; otherwise greeting only. */
async function weatherFragmentForGreeting(): Promise<string | null> {
  const coords = await coordsFromBrowser()
  if (!coords) return null

  const res = await fetch(
    `/api/weather/current?lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lon))}`
  )
  if (!res.ok) return null

  const w = (await res.json()) as { description: string; tempC: number; feelsLikeC?: number }
  const temp = Math.round(w.tempC)
  const feels = Math.round(w.feelsLikeC ?? w.tempC)
  const desc = w.description
  return `It's ${temp} degrees Celsius, feels like ${feels}, ${desc}.`
}

async function tasksLine(): Promise<string> {
  const res = await fetch("/api/tasks")
  if (!res.ok) return "I couldn't load your tasks."
  const json = (await res.json()) as { tasks?: TaskRow[] }
  const tasks = json.tasks ?? []
  return buildTodayTasksSummary(tasks)
}

async function nextRecommendationLine(): Promise<string> {
  const res = await fetch("/api/ai/wake-next-recommendation", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  })
  if (!res.ok) {
    return "I couldn't load a suggestion for what to do next."
  }
  const json = (await res.json()) as { recommendation?: string }
  const line = typeof json.recommendation === "string" ? json.recommendation.trim() : ""
  return line || "Pick an open task that supports your health, growth, relationships, or livelihood, and take one concrete step in the next twenty-five minutes."
}

async function runPostWakeBriefing(): Promise<void> {
  if (typeof window === "undefined") return

  try {
    const prefs = await fetchBriefingPreferences()
    const wx = await weatherFragmentForGreeting()
    const greetingLine = wx ? `${prefs.greeting} ${wx}` : prefs.greeting
    await speak(greetingLine, prefs.voice)
    await pauseMs(1000)
    const tasks = await tasksLine()
    await speak(tasks, prefs.voice)
    const next = await nextRecommendationLine()
    await speak(next, prefs.voice)
  } catch {
    /* */
  }
}
