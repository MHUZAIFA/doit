import Link from "next/link"

export default function OfflinePage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-md text-muted-foreground">
        DoIt will use cached pages when possible. Reconnect to sync tasks and schedules.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try dashboard
      </Link>
    </div>
  )
}
