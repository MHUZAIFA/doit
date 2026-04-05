/**
 * User-selected wake briefing voice ({@link pickWakeVoice}) and prefs from `/api/auth/me`.
 * Shared by post-wake briefing and the create-task voice assistant.
 */

export const WAKE_SPEECH_RATE = 1
export const WAKE_SPEECH_PITCH = 1

export const DEFAULT_WAKE_GREETING = "Welcome back sir!"

/** Preference `wakeVoiceNameIncludes`: `""`, or `name|||lang` from the voice picker, or legacy substring. */
export function pickWakeVoice(stored: string): SpeechSynthesisVoice | null {
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

export async function fetchWakeSpeechUserPrefs(): Promise<{ voice: string; greeting: string }> {
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
