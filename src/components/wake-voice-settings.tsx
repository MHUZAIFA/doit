"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { filterHumanLikeEnglishVoices } from "@/lib/speech-voices"

const DEFAULT_GREETING = "Welcome back sir!"

function voiceKey(name: string, lang: string) {
  return `${name}|||${lang}`
}

export function WakeVoiceSettings({
  wakeVoiceNameIncludes,
  wakeGreeting,
  onSaved,
}: {
  wakeVoiceNameIncludes: string
  wakeGreeting: string
  onSaved?: () => void
}) {
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceValue, setVoiceValue] = useState(wakeVoiceNameIncludes)
  const [greeting, setGreeting] = useState(wakeGreeting || DEFAULT_GREETING)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setVoiceValue(wakeVoiceNameIncludes)
  }, [wakeVoiceNameIncludes])

  useEffect(() => {
    setGreeting(wakeGreeting || DEFAULT_GREETING)
  }, [wakeGreeting])

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const load = () => {
      setAllVoices([...window.speechSynthesis.getVoices()])
    }
    load()
    window.speechSynthesis.addEventListener("voiceschanged", load)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load)
  }, [])

  const displayVoices = useMemo(() => {
    const base = filterHumanLikeEnglishVoices(allVoices)
    const key = voiceValue.trim()
    if (!key || key.indexOf("|||") === -1) return base
    const sep = key.indexOf("|||")
    const name = key.slice(0, sep)
    const lang = key.slice(sep + 3)
    if (base.some((v) => v.name === name && v.lang === lang)) return base
    const extra = allVoices.find((v) => v.name === name && v.lang === lang)
    return extra ? [extra, ...base] : base
  }, [allVoices, voiceValue])

  /** Resolve legacy substring preferences to a single `name|||lang` when voices load. */
  useEffect(() => {
    if (allVoices.length === 0) return
    const raw = wakeVoiceNameIncludes.trim()
    if (!raw) return
    if (raw.includes("|||")) return
    const exact = allVoices.find((v) => v.name === raw)
    if (exact) {
      setVoiceValue(voiceKey(exact.name, exact.lang))
      return
    }
    const partial = allVoices.filter((v) => v.name.toLowerCase().includes(raw.toLowerCase()))
    if (partial.length === 1) {
      setVoiceValue(voiceKey(partial[0]!.name, partial[0]!.lang))
    }
  }, [allVoices, wakeVoiceNameIncludes])

  const testPhrase = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(greeting.trim() || DEFAULT_GREETING)
    u.lang = "en-US"
    const stored = voiceValue.trim()
    if (stored) {
      const sep = stored.indexOf("|||")
      let v: SpeechSynthesisVoice | undefined
      if (sep !== -1) {
        const name = stored.slice(0, sep)
        const lang = stored.slice(sep + 3)
        v = window.speechSynthesis.getVoices().find((x) => x.name === name && x.lang === lang)
      } else {
        v = window.speechSynthesis
          .getVoices()
          .find((x) => x.name.toLowerCase().includes(stored.toLowerCase()))
      }
      if (v) u.voice = v
    }
    window.speechSynthesis.speak(u)
  }, [greeting, voiceValue])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          wakeVoiceNameIncludes: voiceValue.trim(),
          wakeGreeting: greeting.trim() || DEFAULT_GREETING,
        }),
      })
      const json = (await res.json()) as {
        error?: unknown
        preferences?: { wakeVoiceNameIncludes?: string; wakeGreeting?: string }
      }
      if (!res.ok) {
        toast.error("Could not save preferences")
        return
      }
      if (json.preferences) {
        const p = json.preferences
        if (typeof p.wakeVoiceNameIncludes === "string") {
          setVoiceValue(p.wakeVoiceNameIncludes)
        }
        if (typeof p.wakeGreeting === "string") {
          setGreeting(p.wakeGreeting || DEFAULT_GREETING)
        }
      }
      toast.success("Wake briefing preferences saved")
      onSaved?.()
    } catch {
      toast.error("Could not save preferences")
    } finally {
      setSaving(false)
    }
  }

  const selectValue = voiceValue.trim() === "" ? "__default__" : voiceValue

  return (
    <Card
      size="sm"
      className="rounded-[var(--radius-xs)] border-2 border-border ring-0 dark:border-white/10"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Wake briefing voice</CardTitle>
        <CardDescription>
          After sleep mode, your browser speaks a greeting, then weather, then today&apos;s tasks.
          The list shows English voices that usually sound more natural (neural/cloud, enhanced, or
          common system voices). If none match your device, all English voices are shown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wake-voice">Voice</Label>
          <Select
            value={selectValue}
            onValueChange={(v) => setVoiceValue(v === "__default__" || !v ? "" : v)}
          >
            <SelectTrigger id="wake-voice" className="w-full max-w-md">
              <SelectValue placeholder="Default (English)" />
            </SelectTrigger>
            <SelectContent className="max-h-[min(24rem,var(--radix-select-content-available-height))]">
              <SelectItem value="__default__">Default (first English voice)</SelectItem>
              {displayVoices.map((v) => (
                <SelectItem key={voiceKey(v.name, v.lang)} value={voiceKey(v.name, v.lang)}>
                  {v.name} ({v.lang})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wake-greeting">First phrase</Label>
          <Input
            id="wake-greeting"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder={DEFAULT_GREETING}
            maxLength={300}
            className="max-w-lg"
          />
          <p className="text-xs text-muted-foreground">
            Spoken first when the briefing runs. Default: {DEFAULT_GREETING}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={testPhrase}>
            Test phrase
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
