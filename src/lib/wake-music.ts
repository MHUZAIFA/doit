/**
 * Wake track after sleep mode — file in `public/music/`.
 */
import { toast } from "sonner"

import { cancelScheduledPostWakeBriefing, schedulePostWakeBriefing } from "@/lib/wake-briefing"

/** Exact filename under `public/music/` (spaces OK; URL is encoded). */
const WAKE_MUSIC_FILENAME = "The Clash - Should I Stay or Should I Go Official Video.mp3"

/** Tiny silent WAV — loads synchronously so `play()` runs inside the user-gesture chain. */
const SILENT_WAV_DATA_URL =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"

export class WakeMusic {
  static get src(): string {
    return `/music/${encodeURIComponent(WAKE_MUSIC_FILENAME)}`
  }
  /** First segment (0–1). */
  static readonly initialVolume = 1
  /** After {@link WakeMusic.rampAfterMs}, volume moves here for the rest of the track. */
  static readonly laterVolume = 0.2
  /** Milliseconds before lowering volume (and when the post-wake voice briefing runs). */
  static readonly rampAfterMs = 7_000
}

type ActivePlayback = {
  audio: HTMLAudioElement
  rampTimer: ReturnType<typeof setTimeout>
}

let active: ActivePlayback | null = null

/** Audio element primed during the Power-button click so playback works after clap wake. */
let primedAudio: HTMLAudioElement | null = null

async function fetchWakeMusicMuted(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
    const data = (await res.json()) as { user?: { preferences?: { wakeMusicMuted?: boolean } } }
    return Boolean(data.user?.preferences?.wakeMusicMuted)
  } catch {
    return false
  }
}

function stopActive() {
  cancelScheduledPostWakeBriefing()
  if (!active) return
  clearTimeout(active.rampTimer)
  try {
    active.audio.pause()
  } catch {
    /* */
  }
  active = null
}

function waitCanPlay(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      resolve()
      return
    }
    const onError = () => {
      audio.removeEventListener("canplay", onCanPlay)
      reject(new Error("load failed"))
    }
    const onCanPlay = () => {
      audio.removeEventListener("error", onError)
      resolve()
    }
    audio.addEventListener("canplay", onCanPlay, { once: true })
    audio.addEventListener("error", onError, { once: true })
    audio.load()
  })
}

/**
 * Call from the **same user gesture** as entering sleep (e.g. Power `onClick`).
 * Must be **awaited** so `play()` runs in the gesture chain (not in `canplay`, which is too late).
 */
export async function primeWakeAudioOnUserGesture(): Promise<void> {
  if (typeof window === "undefined") return

  /** Stop any wake playback from a previous wake so the next wake starts the song from 0. */
  stopActive()
  primedAudio = null

  const muted = await fetchWakeMusicMuted()
  if (muted) return

  try {
    const silent = new Audio(SILENT_WAV_DATA_URL)
    await silent.play()
    silent.pause()
    silent.removeAttribute("src")
    silent.load()
  } catch {
    /* silent unlock is best-effort */
  }

  const clash = new Audio(WakeMusic.src)
  clash.preload = "auto"

  try {
    await waitCanPlay(clash)
  } catch {
    toast.error("Could not load wake music", {
      description: `Check that public/music/${WAKE_MUSIC_FILENAME} exists.`,
    })
    return
  }

  try {
    clash.volume = 0.001
    await clash.play()
    clash.pause()
    clash.currentTime = 0
    clash.volume = 1
    primedAudio = clash
  } catch {
    primedAudio = clash
  }
}

/**
 * Plays the wake song after sleep mode ends: {@link WakeMusic.initialVolume} for 15s, then {@link WakeMusic.laterVolume} until the track ends.
 * Stops any previous wake playback.
 */
export function playWakeMusic(): void {
  if (typeof window === "undefined") return

  stopActive()

  void (async () => {
    const muted = await fetchWakeMusicMuted()
    if (muted) {
      primedAudio = null
      schedulePostWakeBriefing(WakeMusic.rampAfterMs)
      return
    }

    playWakeMusicWithAudio()
  })()
}

function playWakeMusicWithAudio(): void {
  if (typeof window === "undefined") return

  const wasPrimed = primedAudio !== null
  const audio = primedAudio ?? new Audio(WakeMusic.src)
  primedAudio = null

  audio.volume = WakeMusic.initialVolume
  audio.preload = "auto"
  audio.currentTime = 0

  const rampTimer = setTimeout(() => {
    if (active?.audio === audio) {
      audio.volume = WakeMusic.laterVolume
    }
  }, WakeMusic.rampAfterMs)

  const cleanup = () => {
    if (active?.audio === audio) {
      clearTimeout(rampTimer)
      active = null
    }
  }

  audio.onended = cleanup
  audio.onerror = () => {
    clearTimeout(rampTimer)
    if (active?.audio === audio) active = null
    toast.error("Could not load wake music", {
      description: `Expected file at public/music/${WAKE_MUSIC_FILENAME}`,
    })
  }

  active = { audio, rampTimer }

  const tryPlay = () => {
    void audio
      .play()
      .then(() => {
        schedulePostWakeBriefing(WakeMusic.rampAfterMs)
      })
      .catch((err: unknown) => {
        clearTimeout(rampTimer)
        if (active?.audio === audio) active = null
        const msg = err instanceof Error ? err.message : String(err)
        toast.error("Could not play wake music", {
          description:
            msg.includes("NotAllowed") || msg.includes("user didn")
              ? "Tap Wake up once, then try sleep again — or allow audio for this site."
              : msg,
        })
      })
  }

  if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    tryPlay()
  } else {
    audio.addEventListener("canplay", () => tryPlay(), { once: true })
    audio.addEventListener(
      "error",
      () => {
        clearTimeout(rampTimer)
        if (active?.audio === audio) active = null
      },
      { once: true }
    )
    if (!wasPrimed) {
      audio.load()
    }
  }
}

