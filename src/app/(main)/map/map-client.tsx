"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Crosshair, Loader2, Route } from "lucide-react"
import { toast } from "sonner"

import { DirectionsRoutePanel } from "@/components/directions-route-panel"
import type { OsmMapPlace } from "@/components/osm-routing-map"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { localDateInputValue } from "@/lib/date"
import { routeStopColorHex } from "@/lib/route-stop-colors"
import { scheduleTaskIdToString } from "@/lib/schedule-task-id"
import { OSM_ROUTING_MAP_FRAME_CLASS } from "@/lib/task-location-map-classes"
import { cn } from "@/lib/utils"

const OsmRoutingMap = dynamic(() => import("@/components/osm-routing-map"), {
  ssr: false,
  loading: () => (
    <div
      className={cn(
        OSM_ROUTING_MAP_FRAME_CLASS,
        "flex min-h-[min(280px,42vh)] items-center justify-center bg-muted/30 text-sm text-muted-foreground"
      )}
    >
      Loading map…
    </div>
  ),
})

type PlanPlace = {
  taskId: string
  title: string
  lat: number
  lng: number
  displayName: string
  hoursTag: string | null
  hoursStatus: "open" | "closed" | "unknown"
  priority?: "low" | "medium" | "high"
  deadline?: string
}

type PlanResponse = {
  places: PlanPlace[]
  closedPlaces: string[]
  routableTaskIds: string[]
  orderedTaskIds: string[]
  routeLine: [number, number][] | null
  routingNote: string | null
  nominatimCalls?: number
}

type ScheduleApi = {
  schedule: {
    scheduleOptions: Array<{ tasks: Array<{ taskId: unknown }> }>
  } | null
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 60_000,
}

export function MapClient() {
  const [selectedDate, setSelectedDate] = useState(() => localDateInputValue())
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [start, setStart] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  /** First routing request runs after we know location (or that it was denied / unavailable). */
  const [geoReady, setGeoReady] = useState(false)
  const planRequestSeq = useRef(0)

  const buildPlanBody = useCallback(async () => {
    let taskIds: string[] | undefined
    try {
      const schRes = await fetch(`/api/schedules?date=${selectedDate}`, {
        credentials: "same-origin",
      })
      if (schRes.ok) {
        const sch = (await schRes.json()) as ScheduleApi
        const slots = sch.schedule?.scheduleOptions?.[0]?.tasks
        if (slots?.length) {
          const ids = slots
            .map((t) => scheduleTaskIdToString(t.taskId))
            .filter((id): id is string => Boolean(id))
          if (ids.length) taskIds = ids
        }
      }
    } catch {
      /* use date-only filter */
    }

    return {
      date: selectedDate,
      ...(taskIds?.length ? { taskIds } : {}),
      ...(start ? { startLat: start.lat, startLng: start.lng } : {}),
    }
  }, [selectedDate, start])

  const runPlan = useCallback(
    async (opts?: { notify?: boolean }) => {
      const seq = ++planRequestSeq.current
      setPlanLoading(true)
      try {
        const body = await buildPlanBody()
        const res = await fetch("/api/routing/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as PlanResponse & { error?: string }
        if (seq !== planRequestSeq.current) return
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Plan failed")
          return
        }
        setPlan(data)
        if (opts?.notify) {
          if (data.routingNote) toast.message(data.routingNote)
          else if (data.routeLine?.length) toast.success("Route updated")
        }
      } catch {
        if (seq === planRequestSeq.current) toast.error("Network error")
      } finally {
        if (seq === planRequestSeq.current) setPlanLoading(false)
      }
    },
    [buildPlanBody]
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!navigator.geolocation) {
      setGeoReady(true)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setLocating(false)
        setGeoReady(true)
      },
      () => {
        setLocating(false)
        setGeoReady(true)
      },
      GEO_OPTIONS
    )
  }, [])

  useEffect(() => {
    if (!geoReady) return
    void runPlan({ notify: false })
  }, [runPlan, geoReady])

  function useMyLocationAsStart() {
    if (!navigator.geolocation) {
      toast.error("Location is not supported in this browser.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setLocating(false)
        toast.success("Start point set — replanning route")
      },
      () => {
        setLocating(false)
        toast.error("Location access was denied or unavailable.")
      },
      GEO_OPTIONS
    )
  }

  const mapPlaces: OsmMapPlace[] = useMemo(() => {
    const places = plan?.places ?? []
    const order = plan?.orderedTaskIds ?? []
    return places.map((p) => {
      const orderIndex = order.indexOf(p.taskId)
      const idx = orderIndex >= 0 ? orderIndex : places.indexOf(p)
      return {
        id: p.taskId,
        lat: p.lat,
        lng: p.lng,
        title: p.title,
        displayName: p.displayName,
        hoursStatus: p.hoursStatus,
        colorHex: routeStopColorHex(idx >= 0 ? idx : 0),
      }
    })
  }, [plan])

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
        {/* Map — left / top on mobile */}
        <div className="min-w-0 lg:sticky lg:top-4 lg:z-10 lg:self-start">
          <OsmRoutingMap
            key={selectedDate}
            className={cn(
              OSM_ROUTING_MAP_FRAME_CLASS,
              "min-h-[min(280px,42vh)] h-[min(380px,52vh)] w-full lg:min-h-[min(440px,40vh)] lg:h-[min(580px,calc(100vh-10rem))]"
            )}
            places={mapPlaces}
            routeLine={plan?.routeLine ?? null}
            start={start}
          />
        </div>

        {/* Sidebar — route controls & stops */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="space-y-1.5">
            <Input
              id="map-day"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setPlan(null)
                setSelectedDate(e.target.value)
              }}
              className="h-10 w-full max-w-46"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="px-0"
              disabled={planLoading || !geoReady}
              onClick={() => void runPlan({ notify: true })}
            >
              {planLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Route className="mr-2 size-4" aria-hidden />
              )}
              Refresh plan
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-0"
              disabled={locating}
              onClick={useMyLocationAsStart}
            >
              {locating ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Crosshair className="mr-2 size-4" aria-hidden />
              )}
              Update location
            </Button>
          </div>

          {plan?.routingNote ? (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {plan.routingNote}
            </p>
          ) : null}

          {plan?.closedPlaces?.length ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-foreground dark:border-amber-400/30 dark:bg-amber-400/10">
              <span className="font-medium">Some stops look closed now</span> — the blue path still
              includes them. Check each stop below for opening hours before you go.
            </p>
          ) : null}

          <p className="text-justify text-xs leading-relaxed text-muted-foreground">
            Missing or unreadable opening hours are treated as{" "}
            <span className="text-foreground">open 24/7</span> for status.{" "}
            <span className="text-foreground">Closed-now</span> places stay on the route; details below
            show when time may not be available.
          </p>

          {plan?.orderedTaskIds?.length ? (
            <DirectionsRoutePanel
              orderedTaskIds={plan.orderedTaskIds}
              places={plan.places}
              start={start}
            />
          ) : null}

          {!plan?.places?.length && !planLoading ? (
            <p className="text-sm text-muted-foreground">
              Nothing to map for this day: deadlines must fall on this date, or generate a schedule for
              this day to include tasks without deadlines. Add places on tasks as needed.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
