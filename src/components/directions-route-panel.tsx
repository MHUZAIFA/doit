"use client"

import { Clock, MapPin, Navigation } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { priorityBadgeVariant } from "@/lib/task-badges"
import { routeStopColorHex } from "@/lib/route-stop-colors"
import { cn } from "@/lib/utils"

export type DirectionsPlace = {
  taskId: string
  title: string
  lat: number
  lng: number
  displayName: string
  hoursStatus: "open" | "closed" | "unknown"
  priority?: "low" | "medium" | "high"
  deadline?: string
}

type Props = {
  orderedTaskIds: string[]
  places: DirectionsPlace[]
  start: { lat: number; lng: number } | null
  className?: string
}

function googleMapsDirUrl(destLat: number, destLng: number, origin?: { lat: number; lng: number }) {
  const base = "https://www.google.com/maps/dir/?api=1"
  const dest = `&destination=${destLat},${destLng}`
  if (origin) {
    return `${base}&origin=${origin.lat},${origin.lng}${dest}&travelmode=driving`
  }
  return `${base}${dest}&travelmode=driving`
}

export function DirectionsRoutePanel({ orderedTaskIds, places, start, className }: Props) {
  const n = orderedTaskIds.length
  if (n === 0) return null

  return (
    <div
      className={cn(
        "bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      {/* Panel header — similar to Maps “Directions” strip */}
      <div className="flex items-center gap-3 border-b border-border/80 bg-muted/40 py-3 dark:bg-muted/25">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Navigation className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-tight text-foreground">Suggested route</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {n} {n === 1 ? "stop" : "stops"}
            {start ? " · from your location" : ""} · ordered by priority and deadline
          </p>
        </div>
      </div>

      <div className="py-4">
        <ol className="relative m-0 list-none p-0">
          {/* Origin — like “Your location” in Google Maps */}
          {start ? (
            <li className="relative flex gap-3 pb-1">
              <div className="flex w-9 shrink-0 flex-col items-center pt-0.5">
                <div
                  className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center overflow-visible"
                  aria-hidden
                >
                  <span
                    className="location-dot-pulse relative z-10 size-4 shrink-0 rounded-full border-[3px] border-emerald-600 bg-emerald-500 dark:border-emerald-100/90 dark:bg-emerald-400"
                    title="Live location"
                  />
                </div>
                <div
                  className="mt-1 w-0.5 flex-1 min-h-[28px] rounded-full bg-border dark:bg-border/90"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5 pb-6">
                <p className="text-[15px] font-medium leading-snug text-foreground">Your location</p>
                <p className="text-[13px] text-muted-foreground">Starting point</p>
              </div>
            </li>
          ) : null}

          {orderedTaskIds.map((id, index) => {
            const t = places.find((x) => x.taskId === id)
            const title = t?.title ?? id
            const pri = t?.priority
            const address = t?.displayName?.trim()
            const isLast = index === n - 1
            let from: { lat: number; lng: number } | undefined
            if (index === 0) {
              from = start ?? undefined
            } else {
              const prev = places.find((p) => p.taskId === orderedTaskIds[index - 1])
              if (prev) from = { lat: prev.lat, lng: prev.lng }
            }
            const gmapsHref = t ? googleMapsDirUrl(t.lat, t.lng, from) : null
            const stopColor = routeStopColorHex(index)

            return (
              <li key={id} className="relative flex gap-3">
                <div className="flex w-9 shrink-0 flex-col items-center pt-0.5">
                  <span
                    className="z-10 flex size-8 items-center justify-center rounded-full border-2 border-solid bg-background text-[13px] font-semibold tabular-nums shadow-sm ring-2 ring-background"
                    style={{ borderColor: stopColor, color: stopColor }}
                    aria-label={`Stop ${index + 1}`}
                  >
                    {index + 1}
                  </span>
                  {!isLast ? (
                    <div
                      className="mt-1 w-0.5 flex-1 min-h-[32px] rounded-full bg-border dark:bg-border/90"
                      aria-hidden
                    />
                  ) : null}
                </div>

                <div
                  className={cn(
                    "min-w-0 flex-1 space-y-2 border-b border-border/50 pb-5",
                    isLast && "border-0 pb-0"
                  )}
                >
                  <div className="space-y-1">
                    <p className="text-[15px] font-medium leading-snug text-foreground">{title}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 mt-2 mb-3">
                    {pri ? (
                      <Badge
                        variant={priorityBadgeVariant(pri)}
                        className="h-4 px-1.5 text-[10px] font-medium capitalize leading-none"
                      >
                        {pri}
                      </Badge>
                    ) : null}
                    {t?.hoursStatus === "closed" ? (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-normal leading-none">
                        Closed
                      </Badge>
                    ) : t?.hoursStatus === "unknown" ? (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal leading-none">
                        Hours unclear
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="h-4 border-emerald-500/45 px-1.5 text-[10px] font-normal leading-none text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300"
                      >
                        Open
                      </Badge>
                    )}
                  </div>

                  {address ? (
                    <p className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 text-[13px] leading-snug text-muted-foreground">
                      <span className="flex w-4 shrink-0 items-center justify-center self-start h-lh">
                        <MapPin className="size-3.5 opacity-70" aria-hidden />
                      </span>
                      <span className="min-w-0 line-clamp-3">{address}</span>
                    </p>
                  ) : null}

                  <div className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 text-[13px] leading-snug tabular-nums text-muted-foreground">
                    <span className="flex w-4 shrink-0 items-center justify-center self-start h-lh">
                      <Clock className="size-3.5 opacity-70" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      {t?.deadline
                        ? new Date(t.deadline).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "No deadline"}
                    </span>
                  </div>

                  {gmapsHref ? (
                    <a
                      href={gmapsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-[12px] font-medium text-primary hover:underline"
                    >
                      Open in Google Maps
                    </a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
