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
  onRegisterLoopStart,
  onTranscript,
  onStopWithText,
}: {
  disabled?: boolean
  /** Start listening for “Hey Friday” once when mounted and not disabled. */
  autoStart?: boolean
  /** After a capture finishes with text, listen for “Hey Friday” again (see onRegisterLoopStart). */
  loopWakeAfterSession?: boolean
  /** Receive `start` so you can call it after async work (e.g. parse) when looping. */
  onRegisterLoopStart?: (start: () => Promise<void>) => void
  onTranscript: (text: string) => void
  /** After you stop listening, receives full captured text (only if non-empty). */
  onStopWithText: (text: string) => void
}) {
  const { listening, status, start, stop, greetingText, speechDetected } =
    useHeyFridayVoice({
    onTranscript,
    onSessionEnd: (full) => {
      if (full.trim()) onStopWithText(full)
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

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-border/70 bg-background/60 p-3.5 shadow-inner dark:border-white/8 dark:bg-background/30 sm:flex-row sm:items-center sm:justify-between"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={listening ? "secondary" : "outline"}
          size="sm"
          className="gap-2"
          disabled={disabled}
          onClick={listening ? stop : () => void start()}
          aria-pressed={listening}
        >
          {listening ? (
            <>
              <Square className="size-3.5 fill-current" aria-hidden />
              Stop listening
            </>
          ) : (
            <>
              <Mic className="size-3.5 opacity-80" aria-hidden />
              Hey Friday (voice)
            </>
          )}
        </Button>
        {listening ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[12px] leading-snug text-muted-foreground">
              {status === "waiting_wake" &&
                'Say "Hey Friday" when ready. Friday will reply, then say your task — listening stays on.'}
              {status === "greeting" && (
                <>
                  Friday says:{" "}
                  <span className="font-medium text-foreground">&quot;{greetingText}&quot;</span>
                </>
              )}
              {status === "capturing" &&
                "Describe your task — pause when done and we’ll parse the form (or tap Stop)."}
            </span>
            {status === "waiting_wake" && (
              <span
                className={
                  speechDetected
                    ? "shrink-0 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                    : "shrink-0 text-[11px] text-amber-700/90 dark:text-amber-300/90"
                }
                role="status"
              >
                {speechDetected
                  ? "Hearing speech — keep going."
                  : "No speech yet — check mic isn’t muted."}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground">
            Mic off — tap the button to listen for &quot;Hey Friday&quot; again (Chrome/Edge).
          </span>
        )}
      </div>
    </div>
  )
}
