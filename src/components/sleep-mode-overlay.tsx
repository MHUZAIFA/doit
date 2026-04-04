"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, Moon, Volume2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  /** When true, fullscreen sleep UI is shown and mic may listen for claps. */
  active: boolean
  onWake: () => void
}

type WakePhase = "claps" | "phrase"

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

  useEffect(() => {
    onWakeRef.current = onWake
  }, [onWake])

  useEffect(() => {
    if (!active) {
      setPhase("claps")
      setSpeechUnsupported(false)
    }
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
        const now = performance.now()

        analyser.getFloatTimeDomainData(data)
        const { clap, rms } = detectClap(data, smoothedRms, {
          minRms: 0.035,
          peakThreshold: 0.22,
          spikeRatio: 2.75,
          noiseFloor: 0.006,
        })
        smoothedRms = smoothedRms * 0.9 + rms * 0.1

        if (firstClapAt !== null && now - firstClapAt > maxDoubleClapGapMs) {
          firstClapAt = null
        }

        const risingEdge = clap && !wasClapping
        wasClapping = clap

        if (risingEdge) {
          if (firstClapAt === null || now - firstClapAt > maxDoubleClapGapMs) {
            firstClapAt = now
          } else if (now - firstClapAt >= minBetweenClapsMs) {
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

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Sleep mode"
      tabIndex={-1}
      className={cn(
        "fixed inset-0 z-200 flex flex-col items-center justify-center gap-6 bg-black/88 px-6 text-center backdrop-blur-sm",
        "outline-none duration-200 animate-in fade-in"
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape") wake()
      }}
    >
      <div className="pointer-events-none flex flex-col items-center gap-3">
        <Moon className="size-14 text-slate-200/90" aria-hidden />
        <p className="text-xl font-medium tracking-tight text-slate-100">Sleep mode</p>
        {phase === "claps" ? (
          <p className="max-w-sm text-[15px] leading-relaxed text-slate-400">
            Double-clap, then say: <span className="text-slate-300">“{WAKE_PHRASE_DISPLAY}”</span>
          </p>
        ) : (
          <p className="flex max-w-sm flex-col items-center gap-2 text-[15px] leading-relaxed text-slate-400">
            <span className="inline-flex items-center gap-2 text-emerald-300/90">
              <Mic className="size-4 shrink-0" aria-hidden />
              Listening… say the phrase.
            </span>
            <span className="text-slate-500">“{WAKE_PHRASE_DISPLAY}”</span>
          </p>
        )}
        {speechUnsupported ? (
          <p className="max-w-sm text-[13px] leading-relaxed text-amber-200/90">
            Speech recognition isn’t available in this browser. Use the Wake up button below.
          </p>
        ) : null}
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Volume2 className="size-3.5 shrink-0 opacity-80" aria-hidden />
          Microphone is used only while this screen is open.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="pointer-events-auto gap-2 border border-white/10 bg-white/10 text-slate-100 hover:bg-white/15"
        onClick={(e) => {
          e.stopPropagation()
          wake()
        }}
      >
        <X className="size-4" aria-hidden />
        Wake up
      </Button>
    </div>
  )
}
