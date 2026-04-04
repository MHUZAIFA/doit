import Link from "next/link"

import { siteFooterScrollPadding } from "@/components/site-footer"

export default function OfflinePage() {
  return (
    <div
      className={`flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center ${siteFooterScrollPadding}`}
    >
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-md text-muted-foreground">
        Cached pages may be available when offline. Reconnect to sync tasks and schedules.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center justify-center rounded-[var(--radius-xs)] bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try dashboard
      </Link>
    </div>
  )
}
