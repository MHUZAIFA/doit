"use client"

import { useRouter } from "next/navigation"

import { SleepModeOverlay } from "@/components/sleep-mode-overlay"
import { SLEEP_RETURN_TO_KEY } from "@/lib/constants"
import { playWakeMusic } from "@/lib/wake-music"

function safeReturnPath(stored: string | null): string {
  if (!stored || !stored.startsWith("/")) return "/dashboard"
  if (stored.startsWith("//")) return "/dashboard"
  return stored
}

export default function SleepPage() {
  const router = useRouter()

  function onWake() {
    playWakeMusic()
    let path = "/dashboard"
    try {
      path = safeReturnPath(sessionStorage.getItem(SLEEP_RETURN_TO_KEY))
      sessionStorage.removeItem(SLEEP_RETURN_TO_KEY)
    } catch {
      /* */
    }
    router.push(path)
  }

  return <SleepModeOverlay active onWake={onWake} />
}
