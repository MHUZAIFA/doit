"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Pause, Play, Power } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SLEEP_RETURN_TO_KEY } from "@/lib/constants"
import {
  getWakeMusicNavbarState,
  pauseWakeMusic,
  primeWakeAudioOnUserGesture,
  resumeWakeMusic,
  subscribeWakeMusicPlayback,
} from "@/lib/wake-music"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationsPopover } from "@/components/notifications-popover"
import { siteFooterScrollPadding } from "@/components/site-footer"

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [wakeMusic, setWakeMusic] = useState(getWakeMusicNavbarState)

  useEffect(() => {
    setWakeMusic(getWakeMusicNavbarState())
    return subscribeWakeMusicPlayback(() => setWakeMusic(getWakeMusicNavbarState()))
  }, [])

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 bg-background">
        <div className="mx-auto flex h-14 max-w-8xl items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[13px] font-semibold tracking-tight text-foreground hover:opacity-80"
            >
              Done.
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <NotificationsPopover />
            <ThemeToggle />
            {wakeMusic.visible ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                aria-label={wakeMusic.playing ? "Pause wake music" : "Resume wake music"}
                title={wakeMusic.playing ? "Pause wake music" : "Resume wake music"}
                onClick={() => {
                  if (wakeMusic.playing) pauseWakeMusic()
                  else resumeWakeMusic()
                }}
              >
                {wakeMusic.playing ? (
                  <Pause className="size-[1.125rem]" aria-hidden />
                ) : (
                  <Play className="size-[1.125rem]" aria-hidden />
                )}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Sleep mode — double-clap or tap to wake"
              title="Sleep mode"
              onClick={async () => {
                await primeWakeAudioOnUserGesture()
                try {
                  sessionStorage.setItem(SLEEP_RETURN_TO_KEY, pathname)
                } catch {
                  /* */
                }
                router.push("/sleep")
              }}
            >
              <Power className="size-[1.125rem]" aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 ${siteFooterScrollPadding}`}
      >
        {children}
      </main>
    </div>
  )
}
