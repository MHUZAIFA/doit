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
}: {
  blocks: TimelineBlock[]
  dayStartHour?: number
  dayEndHour?: number
}) {
  const startMin = dayStartHour * 60
  const endMin = dayEndHour * 60
  const span = endMin - startMin

  return (
    <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 text-sm font-medium">Today&apos;s timeline</div>
      <div className="relative h-48 overflow-hidden rounded-lg bg-muted/40">
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
                "absolute left-12 right-2 rounded-md px-2 py-1 text-xs font-medium shadow-sm ring-1 ring-foreground/10",
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
