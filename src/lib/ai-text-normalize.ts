/**
 * Normalize capitalization and punctuation for AI-parsed task text fields.
 * Conservative: does not rewrite proper nouns wholesale; fixes common issues.
 */

function capitalizeFirstLetter(s: string): string {
  const t = s.trim()
  if (!t) return ""
  const c = t[0]!
  if (c >= "a" && c <= "z") {
    return c.toUpperCase() + t.slice(1)
  }
  return t
}

/** Capitalize the first letter after sentence-ending punctuation. */
function capitalizeAfterSentenceEnds(s: string): string {
  return s.replace(/([.!?])\s+([a-z])/g, (_, punct: string, letter: string) => `${punct} ${letter.toUpperCase()}`)
}

/** Standalone "i" → "I" (English). */
function fixStandaloneI(s: string): string {
  return s.replace(/\b(i)\b/g, "I")
}

/**
 * Single-line title: trim, collapse spaces, capitalize, fix I, optional closing period.
 */
export function normalizeTaskTitleField(s: string): string {
  let t = s.trim().replace(/\s+/g, " ")
  if (!t) return ""
  t = capitalizeFirstLetter(t)
  t = capitalizeAfterSentenceEnds(t)
  t = fixStandaloneI(t)
  if (!/[.!?]$/.test(t) && /[A-Za-z0-9]$/.test(t)) {
    t += "."
  }
  return t
}

function capitalizeBulletOrLine(line: string): string {
  const bullet = line.match(/^(\s*[-*•]\s+)(.+)$/)
  if (bullet) {
    const rest = capitalizeFirstLetter(capitalizeAfterSentenceEnds(fixStandaloneI(bullet[2]!)))
    return bullet[1] + rest
  }
  return capitalizeFirstLetter(capitalizeAfterSentenceEnds(fixStandaloneI(line)))
}

/**
 * Notes / description: preserve paragraphs and line breaks; fix caps and sentence breaks per block.
 */
export function normalizeTaskDescriptionField(s: string): string {
  let t = s.trim().replace(/\r\n/g, "\n")
  t = t.replace(/\n{3,}/g, "\n\n")
  const blocks = t.split(/\n\n+/)
  return blocks
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
      if (lines.length === 0) return ""
      return lines.map((line) => capitalizeBulletOrLine(line.replace(/\s+/g, " "))).join("\n")
    })
    .filter((b) => b.length > 0)
    .join("\n\n")
}

/**
 * Place / address label: trim and fix capitalization without forcing a trailing period.
 */
export function normalizeLocationLabelField(s: string): string {
  let t = s.trim().replace(/\s+/g, " ")
  if (!t) return ""
  t = capitalizeFirstLetter(t)
  t = capitalizeAfterSentenceEnds(t)
  t = fixStandaloneI(t)
  return t
}
