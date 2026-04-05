"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"

import { SLEEP_RETURN_TO_KEY } from "@/lib/constants"
import { playWakeMusic } from "@/lib/wake-music"

/** Client-only: mic, geolocation, speech, and theme-aware styles avoid SSR/client drift. */
const SleepModeOverlay = dynamic(
  () => import("@/components/sleep-mode-overlay").then((m) => m.SleepModeOverlay),
  {
    ssr: false,
    loading: () => (
      <div
        className="fixed inset-0 z-200 bg-[#ffffff] dark:bg-[#000000]"
        aria-hidden
        suppressHydrationWarning
      />
    ),
  }
)

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
