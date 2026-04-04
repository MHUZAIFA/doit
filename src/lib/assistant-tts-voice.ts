/**
 * Browser {@link SpeechSynthesis} tuning toward a calm British “house AI” read
 * (Jarvis-like: measured pace, slightly low pitch, en-GB when available).
 */

export const ASSISTANT_GREETING = "Welcome back sir"

/** Typical Web Speech API range is ~0.5–2; Jarvis reads a bit slower and steadier. */
const JARVIS_LIKE_RATE = 0.93
const JARVIS_LIKE_PITCH = 0.88

export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([])
  }
  const synth = window.speechSynthesis
  const existing = synth.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)

  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      synth.removeEventListener("voiceschanged", finish)
      resolve(synth.getVoices())
    }
    synth.addEventListener("voiceschanged", finish)
    setTimeout(finish, 750)
  })
}

function scoreJarvisLikeVoice(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase()
  const name = `${v.name} ${v.lang}`.toLowerCase()

  let s = 0
  if (lang.startsWith("en-gb")) s += 100
  else if (lang.startsWith("en-au")) s += 25
  else if (lang.startsWith("en-us") || lang.startsWith("en-ca")) s += 8

  if (
    name.includes("daniel") ||
    name.includes("arthur") ||
    name.includes("google uk english male") ||
    name.includes("uk english male") ||
    name.includes("british male") ||
    (name.includes("male") && !name.includes("female"))
  ) {
    s += 45
  }
  if (name.includes("female") || name.includes("samantha") || name.includes("victoria")) {
    s -= 60
  }
  if (name.includes("premium") || name.includes("enhanced")) s += 5

  return s
}

/** Prefer en-GB / British male-sounding system voices; fallback is best-scored English voice. */
export function pickJarvisLikeVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"))
  const pool = english.length > 0 ? english : voices
  if (pool.length === 0) return null

  let best: SpeechSynthesisVoice | null = null
  let bestScore = -Infinity
  for (const v of pool) {
    const sc = scoreJarvisLikeVoice(v)
    if (sc > bestScore) {
      bestScore = sc
      best = v
    }
  }
  return best
}

export function applyJarvisSpeechStyle(
  u: SpeechSynthesisUtterance,
  voice: SpeechSynthesisVoice | null
): void {
  u.rate = JARVIS_LIKE_RATE
  u.pitch = JARVIS_LIKE_PITCH
  if (voice) {
    u.voice = voice
    u.lang = voice.lang || "en-GB"
  } else {
    u.lang = "en-GB"
  }
}
