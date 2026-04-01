"use client"

import { WifiOff } from "lucide-react"

import { useOnline } from "@/lib/hooks/use-online"

export function OfflineBanner() {
  const online = useOnline()

  if (online) return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-100"
    >
      <WifiOff className="size-4 shrink-0" />
      You&apos;re offline. Cached views may be available; changes will sync when you reconnect.
    </div>
  )
}
