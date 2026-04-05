"use client"

import { useEffect, useState } from "react"

type VoiceRow = {
  name: string
  lang: string
  default: boolean
  localService: boolean
}

export function SpeechVoicesList() {
  const [voices, setVoices] = useState<VoiceRow[]>([])
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setUnsupported(true)
      return
    }
    const load = () => {
      setVoices(
        window.speechSynthesis.getVoices().map((v) => ({
          name: v.name,
          lang: v.lang,
          default: v.default,
          localService: v.localService,
        }))
      )
    }
    load()
    window.speechSynthesis.addEventListener("voiceschanged", load)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load)
  }, [])

  if (unsupported) {
    return <p className="text-muted-foreground">Speech synthesis is not available in this environment.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Lang</th>
            <th className="px-3 py-2 font-medium">Default</th>
            <th className="px-3 py-2 font-medium">Local</th>
          </tr>
        </thead>
        <tbody>
          {voices.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-muted-foreground">
                No voices yet — try refreshing; Chrome loads voices asynchronously.
              </td>
            </tr>
          ) : (
            voices.map((v) => (
              <tr key={`${v.name}-${v.lang}`} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-mono text-[13px]">{v.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{v.lang}</td>
                <td className="px-3 py-2">{v.default ? "yes" : ""}</td>
                <td className="px-3 py-2">{v.localService ? "yes" : ""}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {voices.length} voice{voices.length === 1 ? "" : "s"} — copy part of a name into{" "}
        <code className="rounded bg-muted px-1 py-0.5">WAKE_VOICE_NAME_INCLUDES</code> in{" "}
        <code className="rounded bg-muted px-1 py-0.5">src/lib/wake-briefing.ts</code>
      </p>
    </div>
  )
}
