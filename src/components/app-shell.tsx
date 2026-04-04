"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationsPopover } from "@/components/notifications-popover"
import { siteFooterScrollPadding } from "@/components/site-footer"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks/new", label: "Tasks", icon: ListTodo },
  { href: "/schedule", label: "AI schedule", icon: CalendarDays },
  { href: "/map", label: "Map", icon: MapPin },
  { href: "/chat", label: "AI chat", icon: MessageSquare },
]

function NavLinks({ mobile = false, pathname }: { mobile?: boolean; pathname: string }) {
  return (
    <nav className={cn("flex gap-1", mobile ? "flex-col" : "items-center max-lg:hidden")}>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet>
              <SheetTrigger
                className={buttonVariants({ variant: "outline", size: "icon" })}
                aria-label="Open menu"
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-2">
                  <NavLinks mobile pathname={pathname} />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Link href="/dashboard" className="text-[13px] font-semibold tracking-tight text-foreground hover:opacity-80">
            Done.
          </Link>

          <NavLinks pathname={pathname} />

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
