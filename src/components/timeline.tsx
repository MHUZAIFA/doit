"use client"

import { cn } from "@/lib/utils"

export type TimelineBlock = {
  id: string
  label: string
  start: Date
  end: Date
  tone?: "default" | "muted" | "accent"
}

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

export function ScheduleTimeline({
  blocks,
  dayStartHour = 7,
  dayEndHour = 21,
  title = "Today's plan",
  description = "Top schedule option for this day. Generate more on the schedule page.",
  emptyMessage = "No timed blocks yet. Generate a schedule for today to see it here.",
}: {
  blocks: TimelineBlock[]
  dayStartHour?: number
  dayEndHour?: number
  title?: string
  description?: string
  emptyMessage?: string
}) {
  const startMin = dayStartHour * 60
  const endMin = dayEndHour * 60
  const span = endMin - startMin

  return (
    <div className="rounded-[var(--radius-xs)] border-2 border-border bg-card p-4 dark:border-white/10">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-medium tracking-tight">{title}</h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {dayStartHour}:00–{dayEndHour}:00
        </span>
      </div>
      <p className="mb-3 text-[13px] text-muted-foreground">{description}</p>
      <div className="relative h-52 overflow-hidden rounded-[var(--radius-xs)] bg-muted/30 dark:bg-muted/20">
        <div className="absolute inset-0 flex flex-col justify-between py-2 pl-12 pr-2">
          {Array.from({ length: Math.min(5, dayEndHour - dayStartHour + 1) }).map((_, i) => {
            const h = dayStartHour + Math.floor((i * (dayEndHour - dayStartHour)) / 4)
            return (
              <div key={h} className="flex items-center text-[10px] text-muted-foreground">
                <span className="absolute left-2 w-8 shrink-0">{h}:00</span>
                <div className="h-px flex-1 bg-border/80" />
              </div>
            )
          })}
        </div>
        {blocks.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : null}
        {blocks.map((b) => {
          const sm = minutesSinceMidnight(b.start)
          const em = minutesSinceMidnight(b.end)
          const top = ((sm - startMin) / span) * 100
          const height = Math.max(4, ((em - sm) / span) * 100)
          if (em < startMin || sm > endMin) return null
          return (
            <div
              key={b.id}
              className={cn(
                "absolute left-12 right-2 rounded-[var(--radius-xs)] border border-border bg-background px-2 py-1 text-xs font-medium dark:border-white/10",
                b.tone === "accent" && "bg-primary text-primary-foreground",
                b.tone === "muted" && "bg-muted text-muted-foreground",
                (!b.tone || b.tone === "default") && "bg-background text-foreground"
              )}
              style={{
                top: `${Math.max(0, top)}%`,
                height: `${Math.min(100, height)}%`,
              }}
            >
              <div className="truncate">{b.label}</div>
              <div className="text-[10px] opacity-80">
                {b.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                {b.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
