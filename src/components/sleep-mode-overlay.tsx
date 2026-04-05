"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AudioLines,
  Clapperboard,
  CloudSun,
  Keyboard,
  Mic,
  Moon,
  Volume2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  /** When true, fullscreen sleep UI is shown and mic may listen for claps. */
  active: boolean
  onWake: () => void
}

type WakePhase = "claps" | "phrase"

type SleepWeatherState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; tempC: number; feelsLikeC: number; description: string }
  | { status: "unavailable" }

/** Phrase user says after double-clap (flexible ASR matches). */
const WAKE_PHRASE_DISPLAY = "Wake up, daddy's home"

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function normalizeTranscript(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Match “wake up … daddy('s) … home” from live captions. */
function transcriptMatchesWakePhrase(normalized: string): boolean {
  if (!normalized.includes("wake") || !normalized.includes("up")) return false
  if (!normalized.includes("home")) return false
  return (
    normalized.includes("daddy") ||
    normalized.includes("daddys") ||
    normalized.includes("daddies")
  )
}

/** Transient loud sound: high peak (hand clap) or sharp RMS spike vs smoothed noise floor. */
function detectClap(
  data: Float32Array,
  prevSmoothedRms: number,
  opts: { minRms: number; peakThreshold: number; spikeRatio: number; noiseFloor: number }
): { clap: boolean; rms: number } {
  let sum = 0
  let peak = 0
  for (let i = 0; i < data.length; i++) {
    const x = data[i]!
    sum += x * x
    const a = Math.abs(x)
    if (a > peak) peak = a
  }
  const rms = Math.sqrt(sum / data.length)
  const spike =
    prevSmoothedRms > opts.noiseFloor &&
    rms > prevSmoothedRms * opts.spikeRatio &&
    rms >= opts.minRms
  const clap = peak >= opts.peakThreshold || spike
  return { clap, rms }
}

export function SleepModeOverlay({ active, onWake }: Props) {
  const onWakeRef = useRef(onWake)
  const rootRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<WakePhase>("claps")
  const [speechUnsupported, setSpeechUnsupported] = useState(false)
  /** Null until mount so SSR + first client paint match (avoids locale/time hydration mismatch). */
  const [now, setNow] = useState<Date | null>(null)
  const [weather, setWeather] = useState<SleepWeatherState>({ status: "idle" })
  /** Dim by default; after double-clap (phrase phase) full brightness for 10s, then dim again. */
  const [uiDimmed, setUiDimmed] = useState(true)

  useEffect(() => {
    onWakeRef.current = onWake
  }, [onWake])

  useEffect(() => {
    if (!active) {
      setPhase("claps")
      setSpeechUnsupported(false)
      setWeather({ status: "idle" })
      setUiDimmed(true)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    if (phase === "claps") {
      setUiDimmed(true)
      return
    }
    setUiDimmed(false)
    const t = window.setTimeout(() => setUiDimmed(true), 10_000)
    return () => window.clearTimeout(t)
  }, [active, phase])

  useEffect(() => {
    if (!active) return
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setWeather({ status: "unavailable" })
      return
    }
    setWeather({ status: "loading" })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        void (async () => {
          const res = await fetch(
            `/api/weather/current?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
            { credentials: "same-origin" }
          )
          if (!res.ok) {
            setWeather({ status: "unavailable" })
            return
          }
          const w = (await res.json()) as {
            tempC: number
            feelsLikeC?: number
            description: string
          }
          setWeather({
            status: "ready",
            tempC: w.tempC,
            feelsLikeC: w.feelsLikeC ?? w.tempC,
            description: w.description,
          })
        })()
      },
      () => setWeather({ status: "unavailable" }),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 }
    )
  }, [active])

  useEffect(() => {
    if (!active) return
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [active])

  const wake = useCallback(() => {
    onWakeRef.current()
  }, [])

  useEffect(() => {
    if (active) rootRef.current?.focus()
  }, [active])

  /** Double-clap detection; then hand off to phrase phase. */
  useEffect(() => {
    if (!active || phase !== "claps") return

    let cancelled = false
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })
      } catch {
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AudioContextCtor()
      await ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.2
      source.connect(analyser)
      const data = new Float32Array(analyser.fftSize)
      let smoothedRms = 0.03
      let wasClapping = false
      let firstClapAt: number | null = null
      const minBetweenClapsMs = 220
      const maxDoubleClapGapMs = 2000

      const tick = () => {
        if (cancelled) return
        const nowMs = performance.now()

        analyser.getFloatTimeDomainData(data)
        const { clap, rms } = detectClap(data, smoothedRms, {
          minRms: 0.035,
          peakThreshold: 0.22,
          spikeRatio: 2.75,
          noiseFloor: 0.006,
        })
        smoothedRms = smoothedRms * 0.9 + rms * 0.1

        if (firstClapAt !== null && nowMs - firstClapAt > maxDoubleClapGapMs) {
          firstClapAt = null
        }

        const risingEdge = clap && !wasClapping
        wasClapping = clap

        if (risingEdge) {
          if (firstClapAt === null || nowMs - firstClapAt > maxDoubleClapGapMs) {
            firstClapAt = nowMs
          } else if (nowMs - firstClapAt >= minBetweenClapsMs) {
            setPhase("phrase")
            return
          }
        }

        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    void run()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
    }
  }, [active, phase])

  /** After double-clap: listen for the wake phrase (Web Speech API). */
  useEffect(() => {
    if (!active || phase !== "phrase") return

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setSpeechUnsupported(true)
      return
    }

    let cancelled = false
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"

    const tryWake = (text: string) => {
      if (cancelled) return
      if (!transcriptMatchesWakePhrase(normalizeTranscript(text))) return
      cancelled = true
      try {
        rec.abort()
      } catch {
        try {
          rec.stop()
        } catch {
          /* */
        }
      }
      wake()
    }

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let full = ""
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i]![0]!.transcript
      }
      tryWake(full)
    }

    rec.onerror = () => {
      if (cancelled) return
    }

    rec.onend = () => {
      if (cancelled) return
      try {
        rec.start()
      } catch {
        /* */
      }
    }

    try {
      rec.start()
    } catch {
      setSpeechUnsupported(true)
    }

    return () => {
      cancelled = true
      try {
        rec.abort()
      } catch {
        try {
          rec.stop()
        } catch {
          /* */
        }
      }
    }
  }, [active, phase, wake])

  if (!active) return null

  const timeLine =
    now == null
      ? ""
      : now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
  const dateLine =
    now == null
      ? ""
      : now.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })

  const muted = "text-neutral-500 dark:text-neutral-400"
  const subtle = "text-neutral-600 dark:text-neutral-300"

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Sleep mode"
      tabIndex={-1}
      suppressHydrationWarning
      className={cn(
        "fixed inset-0 z-200 flex flex-col bg-[#ffffff] text-[#0a0a0a] outline-none",
        "dark:bg-[#000000] dark:text-[#fafafa]",
        "duration-300 animate-in fade-in"
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape") wake()
      }}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-opacity duration-1000 ease-in-out",
          uiDimmed ? "opacity-[0.36]" : "opacity-100"
        )}
      >
      {/* Top: clock */}
      <header className="flex shrink-0 flex-col items-center gap-0.5 px-6 pt-10 text-center sm:pt-12">
        <p className="min-h-[1.25em] font-mono text-[11px] font-medium tabular-nums tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
          {timeLine || "\u00a0"}
        </p>
        <p className={cn("min-h-[1.25em] text-[10px] uppercase tracking-[0.35em]", muted)}>
          {dateLine || "\u00a0"}
        </p>
        {weather.status === "ready" ? (
          <p className="mt-2 flex max-w-md flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug text-neutral-500 dark:text-neutral-400">
            <CloudSun className="size-3 shrink-0 opacity-70" aria-hidden />
            <span className="font-medium tabular-nums text-[#0a0a0a] dark:text-[#fafafa]">
              {Math.round(weather.tempC)}°C
            </span>
            <span aria-hidden>·</span>
            <span>feels {Math.round(weather.feelsLikeC)}°C</span>
            <span aria-hidden>·</span>
            <span className="capitalize">{weather.description}</span>
          </p>
        ) : null}
      </header>

      {/* Center */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-8 pt-6">
        <div className="flex max-w-md flex-col items-center gap-8 text-center">
          <Moon
            className="size-18 stroke-1 text-neutral-800 dark:text-neutral-100"
            strokeWidth={1}
            aria-hidden
          />

          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.55em] text-neutral-400 dark:text-neutral-500">
              Sleep
            </p>
            <h2 className="text-lg font-light tracking-tight sm:text-xl">Rest the screen</h2>
          </div>

          {/* Phase steps */}
          <div className="flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em]">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors",
                phase === "claps"
                  ? "border-black/25 bg-black/[0.04] text-[#0a0a0a] dark:border-white/30 dark:bg-white/[0.08] dark:text-[#fafafa]"
                  : "border-transparent text-neutral-400 dark:text-neutral-500"
              )}
            >
              <Clapperboard className="size-3 opacity-80" aria-hidden />
              Clap ×2
            </span>
            <span className={cn("font-mono text-[9px]", muted)} aria-hidden>
              →
            </span>
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors",
                phase === "phrase"
                  ? "border-black/25 bg-black/[0.04] text-[#0a0a0a] dark:border-white/30 dark:bg-white/[0.08] dark:text-[#fafafa]"
                  : "border-transparent text-neutral-400 dark:text-neutral-500"
              )}
            >
              <AudioLines className="size-3 opacity-80" aria-hidden />
              Phrase
            </span>
          </div>

          {phase === "claps" ? (
            <p className={cn("max-w-sm text-xs leading-relaxed sm:text-[13px]", subtle)}>
              Double-clap near your device, then say{" "}
              <span className="text-[#0a0a0a] dark:text-[#fafafa]">“{WAKE_PHRASE_DISPLAY}”</span>
            </p>
          ) : (
            <div className="flex max-w-sm flex-col items-center gap-2 text-xs leading-relaxed sm:text-[13px]">
              <span className={cn("inline-flex items-center gap-2", subtle)}>
                <Mic className="size-4 shrink-0 animate-pulse opacity-90" aria-hidden />
                Listening for the phrase…
              </span>
              <span className={cn("font-light", muted)}>“{WAKE_PHRASE_DISPLAY}”</span>
            </div>
          )}

          {speechUnsupported ? (
            <p className="max-w-sm text-xs leading-relaxed text-amber-700 dark:text-amber-300/95">
              Speech recognition isn’t available in this browser. Use Wake up below.
            </p>
          ) : null}

          <div
            className={cn(
              "flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 text-[10px]",
              muted
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Volume2 className="size-3 shrink-0 opacity-70" aria-hidden />
              Mic only on this screen
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Keyboard className="size-3 shrink-0 opacity-70" aria-hidden />
              Esc to wake
            </span>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <footer className="flex shrink-0 justify-center px-6 pb-10 pt-2 sm:pb-12">
        <Button
          type="button"
          variant="outline"
          className={cn(
            "pointer-events-auto h-11 min-w-[10rem] rounded-full border-black/20 bg-transparent text-xs font-medium uppercase tracking-[0.2em]",
            "text-[#0a0a0a] hover:bg-black/[0.04]",
            "dark:border-white/25 dark:text-[#fafafa] dark:hover:bg-white/[0.06]"
          )}
          onClick={(e) => {
            e.stopPropagation()
            wake()
          }}
        >
          <X className="size-4 opacity-70" aria-hidden />
          Wake up
        </Button>
      </footer>
      </div>
    </div>
  )
}
