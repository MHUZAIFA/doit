"use client"

import { useCallback, useEffect, useRef } from "react"
import { Moon, Volume2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  /** When true, fullscreen sleep UI is shown and mic may listen for claps. */
  active: boolean
  onWake: () => void
}

/** Transient loud sound: high peak (hand clap) or sharp RMS spike vs smoothed noise floor. */
function detectClap(
  data: Uint8Array,
  prevSmoothedRms: number,
  opts: { minRms: number; peakThreshold: number; spikeRatio: number }
): { clap: boolean; rms: number } {
  let sum = 0
  let peak = 0
  for (let i = 0; i < data.length; i++) {
    const x = (data[i]! - 128) / 128
    sum += x * x
    const a = Math.abs(x)
    if (a > peak) peak = a
  }
  const rms = Math.sqrt(sum / data.length)
  const spike =
    prevSmoothedRms > 0.012 &&
    rms > prevSmoothedRms * opts.spikeRatio &&
    rms >= opts.minRms
  const clap = peak >= opts.peakThreshold || spike
  return { clap, rms }
}

export function SleepModeOverlay({ active, onWake }: Props) {
  const onWakeRef = useRef(onWake)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    onWakeRef.current = onWake
  }, [onWake])

  const wake = useCallback(() => {
    onWakeRef.current()
  }, [])

  useEffect(() => {
    if (active) rootRef.current?.focus()
  }, [active])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
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
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.2
      source.connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      let smoothedRms = 0.03
      /** Previous frame had “clap” over threshold — used for rising-edge only. */
      let wasClapping = false
      /** Time of first clap in the current double-clap attempt. */
      let firstClapAt: number | null = null
      /** Min time between two *distinct* clap onsets (two hands). */
      const minBetweenClapsMs = 280
      /** Max time after first clap to complete the pair. */
      const maxDoubleClapGapMs = 1800

      const tick = () => {
        if (cancelled) return
        const now = performance.now()

        analyser.getByteTimeDomainData(data)
        const { clap, rms } = detectClap(data, smoothedRms, {
          minRms: 0.06,
          peakThreshold: 0.38,
          spikeRatio: 4,
        })
        smoothedRms = smoothedRms * 0.9 + rms * 0.1

        if (firstClapAt !== null && now - firstClapAt > maxDoubleClapGapMs) {
          firstClapAt = null
        }

        // Only count the *start* of each burst (rising edge), not every frame while audio stays loud.
        const risingEdge = clap && !wasClapping
        wasClapping = clap

        if (risingEdge) {
          if (firstClapAt === null || now - firstClapAt > maxDoubleClapGapMs) {
            firstClapAt = now
          } else if (now - firstClapAt >= minBetweenClapsMs) {
            wake()
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
  }, [active, wake])

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
      onClick={wake}
      onKeyDown={(e) => {
        if (e.key === "Escape") wake()
      }}
    >
      <div className="pointer-events-none flex flex-col items-center gap-3">
        <Moon className="size-14 text-slate-200/90" aria-hidden />
        <p className="text-xl font-medium tracking-tight text-slate-100">Sleep mode</p>
        <p className="max-w-sm text-[15px] leading-relaxed text-slate-400">
          Double-clap to wake. Or tap anywhere, or press Escape.
        </p>
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
