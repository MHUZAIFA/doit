"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationsPopover } from "@/components/notifications-popover"
import { siteFooterScrollPadding } from "@/components/site-footer"

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="text-[13px] font-semibold tracking-tight text-foreground hover:opacity-80"
          >
            Done.
          </Link>

          <div className="ml-auto flex items-center gap-2">
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
