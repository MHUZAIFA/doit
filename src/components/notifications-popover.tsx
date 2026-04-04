"use client"

import { useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Bell,
  CalendarClock,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type NotificationType = "reminder" | "schedule" | "gamification" | "system"

type NotificationRow = {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  createdAt: string
}

const typeMeta: Record<
  NotificationType,
  { icon: LucideIcon; label: string; className: string }
> = {
  reminder: {
    icon: Bell,
    label: "Reminder",
    className:
      "bg-primary/10 text-primary ring-1 ring-primary/15 dark:ring-primary/25",
  },
  schedule: {
    icon: CalendarClock,
    label: "Schedule",
    className:
      "bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/15 dark:text-sky-400 dark:ring-sky-500/25",
  },
  gamification: {
    icon: Trophy,
    label: "Progress",
    className:
      "bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/15 dark:text-amber-400 dark:ring-amber-500/25",
  },
  system: {
    icon: Sparkles,
    label: "System",
    className:
      "bg-muted text-muted-foreground ring-1 ring-border",
  },
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ""
  }
}

export function NotificationsPopover() {
  const [items, setItems] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d: { notifications?: NotificationRow[] }) => {
        setItems(d.notifications ?? [])
      })
      .catch(() => setItems([]))
  }, [open])

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "relative inline-flex size-8 items-center justify-center rounded-[var(--radius-xs)] border border-border bg-background transition-colors hover:bg-muted",
          open && "bg-muted"
        )}
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 px-0.5 h-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold tabular-nums text-white shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),22rem)] gap-0 overflow-hidden p-0 shadow-lg ring-1 ring-border/60"
        align="end"
      >
        <PopoverHeader className="border-b border-border/80 bg-muted/30 px-4 py-3">
          <PopoverTitle className="text-[13px] font-semibold tracking-tight">
            Notifications
          </PopoverTitle>
          <PopoverDescription className="text-[12px] leading-snug">
            {items.length === 0
              ? "Updates from reminders, schedules, and streaks appear here."
              : unread > 0
                ? `${unread} unread`
                : "You’re all caught up."}
          </PopoverDescription>
        </PopoverHeader>

        <ScrollArea className="h-[min(18rem,50vh)]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full border border-dashed border-border bg-muted/40 text-muted-foreground">
                <Bell className="size-5 opacity-70" strokeWidth={1.75} />
              </div>
              <p className="text-[13px] font-medium text-foreground">Nothing new</p>
              <p className="max-w-[16rem] text-[12px] leading-relaxed text-muted-foreground">
                When something needs your attention, you&apos;ll see it here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-px bg-border/60 p-px">
              {items.map((n) => {
                const meta = typeMeta[n.type] ?? typeMeta.system
                const Icon = meta.icon
                return (
                  <li key={n.id}>
                    <div
                      className={cn(
                        "flex gap-3 border-l-2 border-transparent bg-background px-3.5 py-3 text-left transition-colors hover:bg-muted/50",
                        !n.read && "border-l-primary bg-primary/4 hover:bg-primary/6"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                          meta.className
                        )}
                        aria-hidden
                      >
                        <Icon className="size-4" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-[13px] leading-snug",
                              !n.read ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                            )}
                          >
                            {n.title}
                          </p>
                          <time
                            className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                            dateTime={n.createdAt}
                            title={new Date(n.createdAt).toLocaleString()}
                          >
                            {relativeTime(n.createdAt)}
                          </time>
                        </div>
                        <p className="text-[12px] leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                          {meta.label}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
