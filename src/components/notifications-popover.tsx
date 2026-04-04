"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type NotificationRow = {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string
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

  const unread = items.filter((n) => !n.read).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative inline-flex size-8 items-center justify-center rounded-[var(--radius-xs)] border border-border bg-background hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-3 py-2 text-sm font-medium">Notifications</div>
        <ScrollArea className="h-72">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className="px-3 py-2 text-sm">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-muted-foreground">{n.body}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <Separator />
      </PopoverContent>
    </Popover>
  )
}
