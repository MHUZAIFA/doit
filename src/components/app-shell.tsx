"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Power, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SLEEP_RETURN_TO_KEY } from "@/lib/constants"
import { primeWakeAudioOnUserGesture } from "@/lib/wake-music"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationsPopover } from "@/components/notifications-popover"
import { siteFooterScrollPadding } from "@/components/site-footer"

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

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
            <NotificationsPopover />
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={logout}>
              <LogOut className="mr-1 size-4" />
              Sign out
            </Button>
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={logout} aria-label="Sign out">
              <LogOut className="size-4" />
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
