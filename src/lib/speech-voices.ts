/**
 * Heuristic filter for voices that usually sound more natural in the browser.
 * (There is no official “human-like” flag — this follows common patterns across Chrome/Safari/Edge.)
 */

function soundsMoreNatural(v: SpeechSynthesisVoice): boolean {
  const n = v.name.toLowerCase()
  if (/compact|tiny|pipe|whisper|robot/.test(n)) return false
  /** Chrome: Google / cloud voices are often higher quality. */
  if (!v.localService) return true
  if (/enhanced|neural|premium|natural/.test(n)) return true
  if (/\bgoogle\b/.test(n)) return true
  /** macOS / common system voices that are usually pleasant. */
  if (
    /samantha|daniel|karen|moira|fiona|tessa|serena|ava|allison|susan|alloy|nicky|zoe|aaron|flo|zira|hazel|mark|jenny|guy|aria|jason|michelle|ryan|linda|davis|libby|arthur|sarah|henry|oliver|martha|nancy|tony|emily|fred|reed|rocko|shelley|victoria|veena|yuna/.test(
      n
    )
  ) {
    return true
  }
  return false
}

/** Prefer English wake briefings; caller can widen if needed. */
export function filterHumanLikeEnglishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"))
  const natural = english.filter(soundsMoreNatural)
  const list = natural.length > 0 ? natural : english
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}
