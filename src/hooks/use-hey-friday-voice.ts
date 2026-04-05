"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ASSISTANT_GREETING, ensureVoicesLoaded } from "@/lib/assistant-tts-voice"
import {
  fetchWakeSpeechUserPrefs,
  pickWakeVoice,
  WAKE_SPEECH_PITCH,
  WAKE_SPEECH_RATE,
} from "@/lib/wake-speech-voice"
import {
  ensureMicrophoneAccess,
  isVoiceContextSupported,
} from "@/lib/microphone-access"

/**
 * Exported for tests / docs. Live detection uses {@link findWakeInTranscript} (more lenient).
 */
export const HEY_FRIDAY_RE = /hey[\s,.'"-]{0,8}friday/i

/** After this many ms without new speech during capture, we stop STT and submit text for parsing. */
export const DEFAULT_CAPTURE_SILENCE_MS = 3000

/** Build one string from every speech segment (interim + final) so "hey" + "friday" in two chunks still matches. */
function joinRecognitionResults(results: SpeechRecognitionResultList): string {
  const parts: string[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const n = r.length
    const t = (n > 0 ? r[0]?.transcript : "") ?? ""
    if (t.trim()) parts.push(t.trim())
  }
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

/**
 * Browser STT often splits phrases or mis-hears slightly — check the full line, not one segment.
 */
export function findWakeInTranscript(raw: string): { end: number } | null {
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text) return null

  const patterns: RegExp[] = [
    /hey[\s,.'"-]{0,10}friday/i,
    /hey[\s,.'"-]{0,10}frieday/i,
    /hey[\s,.'"-]{0,10}frida\b/i,
    /hay[\s,.'"-]{0,10}friday/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m != null && m.index !== undefined) {
      return { end: m.index + m[0].length }
    }
  }

  const low = text.toLowerCase()
  const heyAt = low.indexOf("hey")
  if (heyAt === -1) return null
  const window = low.slice(heyAt, heyAt + 36)
  const fuzzy = window.match(/hey[\s,.'"-]{0,12}fri[\s,.'"-]{0,4}day/i)
  if (fuzzy && fuzzy.index !== undefined) {
    const start = heyAt + fuzzy.index
    return { end: start + fuzzy[0].length }
  }

  const fri = low.indexOf("friday", heyAt)
  if (fri !== -1 && fri - heyAt <= 24) {
    return { end: fri + "friday".length }
  }

  return null
}

function handleSpeechRecError(ev: SpeechRecognitionErrorEvent) {
  if (ev.error === "no-speech" || ev.error === "aborted") return
  if (ev.error === "not-allowed") {
    toast.error(
      "Microphone access denied. Allow the mic for this site in the browser bar and in system settings."
    )
  } else if (ev.error === "audio-capture") {
    toast.error(
      "We can’t hear your microphone. Unmute it, plug it in, or allow access in System Settings → Privacy → Microphone (macOS) / Sound (Windows)."
    )
  } else if (ev.error === "service-not-allowed") {
    toast.error("Speech recognition isn’t available. Try Google Chrome or Microsoft Edge.")
  } else {
    toast.message(`Speech recognition: ${ev.error}`)
  }
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function speakHowCanIHelp(onDone: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone()
    return
  }
  window.speechSynthesis.cancel()
  void (async () => {
    const [prefs] = await Promise.all([fetchWakeSpeechUserPrefs(), ensureVoicesLoaded()])
    const u = new SpeechSynthesisUtterance(ASSISTANT_GREETING)
    u.lang = "en-US"
    u.rate = WAKE_SPEECH_RATE
    u.pitch = WAKE_SPEECH_PITCH
    const voice = pickWakeVoice(prefs.voice)
    if (voice) u.voice = voice
    u.onend = () => onDone()
    u.onerror = () => onDone()
    window.speechSynthesis.speak(u)
  })()
}

export type HeyFridayStatus = "off" | "waiting_wake" | "greeting" | "capturing"

export function useHeyFridayVoice(options: {
  onTranscript: (text: string) => void
  /** Fires once when “Hey Friday” is detected (before greeting / capture). */
  onWakeDetected?: () => void
  /** Called when recognition stops and there is captured task text (after wake). */
  onSessionEnd?: (fullText: string) => void
  /** Pause length (ms) after your last words before we finalize and run {@link onSessionEnd}. */
  captureSilenceMs?: number
  /**
   * After a capture ends with text (pause, Stop, etc.), start listening for “Hey Friday” again.
   * If {@link registerLoopStart} is set, the host must call `start()` when ready (e.g. after parsing);
   * otherwise the hook restarts wake on the next tick.
   */
  loopWakeAfterSession?: boolean
  /** When set, built-in immediate restart is skipped — call `start()` yourself after async work. */
  registerLoopStart?: boolean
}) {
  const {
    onTranscript,
    onWakeDetected,
    onSessionEnd,
    captureSilenceMs = DEFAULT_CAPTURE_SILENCE_MS,
    loopWakeAfterSession = false,
    registerLoopStart = false,
  } = options
  const onWakeDetectedRef = useRef(onWakeDetected)
  onWakeDetectedRef.current = onWakeDetected
  const recRef = useRef<SpeechRecognition | null>(null)
  const phaseRef = useRef<"seeking_wake" | "capturing">("seeking_wake")
  const bufferRef = useRef("")
  /** Set only when the user taps Stop — skips auto-restart of wake listening. */
  const userStoppedRef = useRef(false)
  /** True after user starts until explicit stop / session end (ignore spurious onend during handoff). */
  const sessionActiveRef = useRef(false)
  const handingOffRef = useRef(false)
  const wakeTriggeredRef = useRef(false)

  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState<HeyFridayStatus>("off")
  /** True once the engine reports enough transcribed text (proves audio path works). */
  const [speechDetected, setSpeechDetected] = useState(false)

  const captureSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCaptureSilenceTimer = useCallback(() => {
    if (captureSilenceTimerRef.current != null) {
      clearTimeout(captureSilenceTimerRef.current)
      captureSilenceTimerRef.current = null
    }
  }, [])

  const startRef = useRef<(() => Promise<void>) | null>(null)
  const loopResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLoopResumeTimer = useCallback(() => {
    if (loopResumeTimerRef.current != null) {
      clearTimeout(loopResumeTimerRef.current)
      loopResumeTimerRef.current = null
    }
  }, [])

  const scheduleRestartWake = useCallback(() => {
    const run = startRef.current
    if (!run) return
    clearLoopResumeTimer()
    loopResumeTimerRef.current = setTimeout(() => {
      loopResumeTimerRef.current = null
      void run()
    }, 0)
  }, [clearLoopResumeTimer])

  const endSession = useCallback(() => {
    clearCaptureSilenceTimer()
    const wasUserStop = userStoppedRef.current
    userStoppedRef.current = false

    sessionActiveRef.current = false
    handingOffRef.current = false
    wakeTriggeredRef.current = false
    setSpeechDetected(false)
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel()
    }
    const full = bufferRef.current.trim()
    bufferRef.current = ""
    phaseRef.current = "seeking_wake"
    recRef.current = null
    setListening(false)
    setStatus("off")
    onSessionEnd?.(full)

    if (!loopWakeAfterSession || wasUserStop) return

    // Parent calls start() after parse when there was captured text.
    if (full && registerLoopStart) return

    // No text (e.g. wake timed out) or path without parent resume — keep listening for "Hey Friday".
    scheduleRestartWake()
  }, [
    onSessionEnd,
    clearCaptureSilenceTimer,
    loopWakeAfterSession,
    registerLoopStart,
    scheduleRestartWake,
  ])

  const stop = useCallback(() => {
    userStoppedRef.current = true
    sessionActiveRef.current = false
    handingOffRef.current = false
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel()
    }
    const rec = recRef.current
    if (rec) {
      rec.onend = null
      recRef.current = null
      try {
        rec.abort()
      } catch {
        /* */
      }
    }
    endSession()
  }, [endSession])

  const attachCaptureRecognition = useCallback(
    (SR: new () => SpeechRecognition) => {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = "en-US"

      /** Speech after “Hey Friday” already in buffer; capture recognition is a new session. */
      const capturePrefix = bufferRef.current.trim()

      rec.onresult = (ev: SpeechRecognitionEvent) => {
        if (phaseRef.current !== "capturing") return
        const captureJoined = joinRecognitionResults(ev.results)
        bufferRef.current = [capturePrefix, captureJoined]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
        if (bufferRef.current) onTranscript(bufferRef.current)

        const t = bufferRef.current.trim()
        if (t.length === 0) return

        clearCaptureSilenceTimer()
        captureSilenceTimerRef.current = setTimeout(() => {
          captureSilenceTimerRef.current = null
          if (!sessionActiveRef.current || phaseRef.current !== "capturing") return
          const text = bufferRef.current.trim()
          if (!text) return
          toast.message("Got it — parsing your task…")
          const r = recRef.current
          if (r && r === rec) {
            try {
              r.stop()
            } catch {
              endSession()
            }
          } else {
            endSession()
          }
        }, captureSilenceMs)
      }

      rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
        clearCaptureSilenceTimer()
        handleSpeechRecError(ev)
        try {
          rec.stop()
        } catch {
          /* */
        }
      }

      rec.onend = () => {
        clearCaptureSilenceTimer()
        if (!sessionActiveRef.current) return
        if (recRef.current === rec) {
          endSession()
        }
      }

      recRef.current = rec
      try {
        rec.start()
        setStatus("capturing")
      } catch {
        toast.error("Could not start microphone")
        endSession()
      }
    },
    [onTranscript, endSession, clearCaptureSilenceTimer, captureSilenceMs]
  )

  const beginCaptureAfterGreeting = useCallback(
    (SR: new () => SpeechRecognition) => {
      setStatus("greeting")
      speakHowCanIHelp(() => {
        if (!sessionActiveRef.current) return
        phaseRef.current = "capturing"
        handingOffRef.current = false
        attachCaptureRecognition(SR)
      })
    },
    [attachCaptureRecognition]
  )

  const startWakeRecognition = useCallback(
    (SR: new () => SpeechRecognition) => {
      phaseRef.current = "seeking_wake"
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = "en-US"
      try {
        ;(rec as unknown as { maxAlternatives: number }).maxAlternatives = 5
      } catch {
        /* optional */
      }

      rec.onresult = (ev: SpeechRecognitionEvent) => {
        if (phaseRef.current !== "seeking_wake" || wakeTriggeredRef.current) return

        const full = joinRecognitionResults(ev.results)
        if (full.replace(/\s/g, "").length >= 2) {
          setSpeechDetected(true)
        }

        const wake = findWakeInTranscript(full)
        if (wake == null) return

        wakeTriggeredRef.current = true
        onWakeDetectedRef.current?.()

        const afterWake = full
          .slice(wake.end)
          .replace(/^[\s,.;:'"-]+/i, "")
          .trim()

        handingOffRef.current = true
        const prev = rec
        prev.onend = null
        try {
          prev.stop()
        } catch {
          /* */
        }
        if (recRef.current === prev) {
          recRef.current = null
        }

        bufferRef.current = afterWake
        if (afterWake) onTranscript(afterWake)

        beginCaptureAfterGreeting(SR)
      }

      rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
        handleSpeechRecError(ev)
        try {
          rec.stop()
        } catch {
          /* */
        }
      }

      rec.onend = () => {
        if (handingOffRef.current) {
          handingOffRef.current = false
          return
        }
        if (!sessionActiveRef.current) return
        if (recRef.current === rec) {
          endSession()
        }
      }

      recRef.current = rec
      try {
        rec.start()
        setListening(true)
        setStatus("waiting_wake")
      } catch {
        toast.error("Could not start microphone")
        sessionActiveRef.current = false
        recRef.current = null
        setListening(false)
        setStatus("off")
      }
    },
    [onTranscript, beginCaptureAfterGreeting, endSession]
  )

  const start = useCallback(async () => {
    const SR = getSpeechRecognitionCtor()
    if (!SR) {
      toast.message("Voice isn’t supported in this browser. Try Chrome or Edge.")
      return
    }

    if (!isVoiceContextSupported()) {
      toast.error(
        "Voice needs a secure connection. Use https:// or http://localhost for development."
      )
      return
    }

    if (recRef.current) {
      const prev = recRef.current
      prev.onend = null
      recRef.current = null
      try {
        prev.stop()
      } catch {
        /* */
      }
    }
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel()
    }

    const micOk = await ensureMicrophoneAccess()
    if (!micOk) {
      toast.error(
        "Microphone blocked or unavailable. Click the lock icon in the address bar → allow Microphone, and check system privacy settings."
      )
      return
    }

    sessionActiveRef.current = true
    handingOffRef.current = false
    wakeTriggeredRef.current = false
    bufferRef.current = ""
    setSpeechDetected(false)

    startWakeRecognition(SR)
  }, [startWakeRecognition])

  /**
   * Skip “Hey Friday” and TTS greeting; start capture immediately (e.g. from “Speak with AI” button).
   */
  const startDirectCapture = useCallback(async () => {
    const SR = getSpeechRecognitionCtor()
    if (!SR) {
      toast.message("Voice isn’t supported in this browser. Try Chrome or Edge.")
      return
    }

    if (!isVoiceContextSupported()) {
      toast.error(
        "Voice needs a secure connection. Use https:// or http://localhost for development."
      )
      return
    }

    if (recRef.current) {
      const prev = recRef.current
      prev.onend = null
      recRef.current = null
      try {
        prev.stop()
      } catch {
        /* */
      }
    }
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel()
    }

    const micOk = await ensureMicrophoneAccess()
    if (!micOk) {
      toast.error(
        "Microphone blocked or unavailable. Click the lock icon in the address bar → allow Microphone, and check system privacy settings."
      )
      return
    }

    onWakeDetectedRef.current?.()

    sessionActiveRef.current = true
    handingOffRef.current = false
    wakeTriggeredRef.current = false
    bufferRef.current = ""
    setSpeechDetected(false)
    phaseRef.current = "capturing"
    setListening(true)

    attachCaptureRecognition(SR)
  }, [attachCaptureRecognition])

  startRef.current = start

  useEffect(
    () => () => {
      sessionActiveRef.current = false
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel()
      }
      const r = recRef.current
      if (r) {
        try {
          r.onend = null
          r.abort()
        } catch {
          /* */
        }
        recRef.current = null
      }
      clearLoopResumeTimer()
    },
    [clearLoopResumeTimer]
  )

  return {
    listening,
    status,
    start,
    startDirectCapture,
    stop,
    greetingText: ASSISTANT_GREETING,
    speechDetected,
  }
}
