"use client"

import { useEffect, useRef } from "react"
import { Mic, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useHeyFridayVoice } from "@/hooks/use-hey-friday-voice"
import { cn } from "@/lib/utils"

export function TaskVoiceHeyFriday({
  disabled,
  autoStart = false,
  loopWakeAfterSession = false,
  /** No start/stop control — status only (e.g. create page with always-on listening). */
  hideControls = false,
  /** Mount voice logic but hide the inline mic/status strip (e.g. dialog-only UI). */
  hideStatusStrip = false,
  onWakeDetected,
  onEmptyCapture,
  onRegisterLoopStart,
  onTranscript,
  onStopWithText,
}: {
  disabled?: boolean
  /** Start listening for “Hey Friday” once when mounted and not disabled. */
  autoStart?: boolean
  /** After a capture finishes with text, listen for “Hey Friday” again (see onRegisterLoopStart). */
  loopWakeAfterSession?: boolean
  hideControls?: boolean
  hideStatusStrip?: boolean
  onWakeDetected?: () => void
  /** Session ended with no speech to parse (e.g. silence after wake). */
  onEmptyCapture?: () => void
  /** Receive `start` so you can call it after async work (e.g. parse) when looping. */
  onRegisterLoopStart?: (start: () => Promise<void>) => void
  onTranscript: (text: string) => void
  /** After you stop listening, receives full captured text (only if non-empty). */
  onStopWithText: (text: string) => void
}) {
  const { listening, status, start, stop, greetingText, speechDetected } =
    useHeyFridayVoice({
    onTranscript,
    onWakeDetected,
    onSessionEnd: (full) => {
      if (full.trim()) onStopWithText(full)
      else onEmptyCapture?.()
    },
    loopWakeAfterSession: loopWakeAfterSession || autoStart,
    /** Parent will call `start()` after async work (e.g. parse); skip hook’s immediate restart. */
    registerLoopStart: Boolean(onRegisterLoopStart),
  })

  useEffect(() => {
    onRegisterLoopStart?.(start)
  }, [start, onRegisterLoopStart])

  const autoStartedRef = useRef(false)
  const stopRef = useRef(stop)
  stopRef.current = stop

  useEffect(() => {
    if (!autoStart) return
    if (disabled) return
    if (autoStartedRef.current) return
    autoStartedRef.current = true
    void start()
  }, [autoStart, disabled, start])

  useEffect(() => {
    if (!autoStart) return
    if (!disabled) return
    stop()
  }, [autoStart, disabled, stop])

  useEffect(() => {
    if (!autoStart) return
    return () => {
      stopRef.current()
      autoStartedRef.current = false
    }
  }, [autoStart])

  const statusBlock =
    listening ? (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-tight text-muted-foreground">
        <span className="min-w-0">
          {status === "waiting_wake" && '“Hey Friday” → then your task.'}
          {status === "greeting" && (
            <span className="font-medium text-foreground">&quot;{greetingText}&quot;</span>
          )}
          {status === "capturing" && "Say task · pause to parse"}
        </span>
        {status === "waiting_wake" && (
          <span
            className={
              speechDetected
                ? "shrink-0 font-medium text-emerald-600 dark:text-emerald-400"
                : "shrink-0 text-amber-700/90 dark:text-amber-300/90"
            }
            role="status"
          >
            {speechDetected ? "Hearing…" : "No input"}
          </span>
        )}
      </div>
    ) : (
      <span className="text-[11px] text-muted-foreground">
        {disabled ? "Voice paused" : hideControls ? "Starting…" : "Tap to listen"}
      </span>
    )

  if (hideStatusStrip) {
    return (
      <div className="sr-only" aria-live="polite">
        {listening ? `${status}` : "voice idle"}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-md border border-border/60 bg-background/50 px-2 py-2 dark:border-white/8 dark:bg-background/30",
        hideControls
          ? "flex min-w-0 items-start gap-2"
          : "flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
      )}
    >
      {hideControls ? (
        <>
          <Mic className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">{statusBlock}</div>
        </>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant={listening ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "h-8 text-[12px]",
              listening ? "size-8 shrink-0 p-0" : "gap-1.5 px-2.5"
            )}
            disabled={disabled}
            onClick={listening ? stop : () => void start()}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Start Hey Friday voice"}
          >
            {listening ? (
              <Square className="size-3.5 fill-current" aria-hidden />
            ) : (
              <>
                <Mic className="size-3 opacity-80" aria-hidden />
                Hey Friday
              </>
            )}
          </Button>
          {statusBlock}
        </div>
      )}
    </div>
  )
}
