"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { Crosshair, ExternalLink, Loader2, Route } from "lucide-react"
import { toast } from "sonner"

import type { OsmMapPlace } from "@/components/osm-routing-map"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const OsmRoutingMap = dynamic(() => import("@/components/osm-routing-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(420px,55vh)] w-full items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground">
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

export function MapClient() {
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [start, setStart] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)

  const runPlan = useCallback(
    async (
      body: { startLat?: number; startLng?: number },
      opts?: { notify?: boolean }
    ) => {
      setPlanLoading(true)
      try {
        const res = await fetch("/api/routing/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as PlanResponse & { error?: string }
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
        toast.error("Network error")
      } finally {
        setPlanLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void runPlan(
      start ? { startLat: start.lat, startLng: start.lng } : {},
      { notify: false }
    )
  }, [runPlan, start])

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
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    )
  }

  function clearStart() {
    setStart(null)
    toast.message("Start cleared — optimizing across task stops only")
  }

  const mapPlaces: OsmMapPlace[] = (plan?.places ?? []).map((p) => ({
    id: p.taskId,
    lat: p.lat,
    lng: p.lng,
    title: p.title,
    displayName: p.displayName,
    hoursStatus: p.hoursStatus,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={planLoading}
          onClick={() =>
            void runPlan(
              start ? { startLat: start.lat, startLng: start.lng } : {},
              { notify: true }
            )
          }
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
          disabled={locating}
          onClick={useMyLocationAsStart}
        >
          {locating ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="mr-2 size-4" aria-hidden />
          )}
          Use my location as start
        </Button>
        {start ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearStart}>
            Clear start
          </Button>
        ) : null}
      </div>

      {plan?.routingNote ? (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {plan.routingNote}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Stops with missing or unreadable opening hours stay on the route as{" "}
        <span className="text-foreground">unknown</span> (not removed). Only places
        that are <span className="text-foreground">closed now</span> are skipped for
        routing. Set{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[12px]">
          OPENROUTESERVICE_API_KEY
        </code>{" "}
        for the blue path; Nominatim is throttled (~1 search/s) when resolving names
        without saved coordinates.
      </p>

      <OsmRoutingMap
        places={mapPlaces}
        routeLine={plan?.routeLine ?? null}
        start={start}
      />

      {plan?.orderedTaskIds?.length ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base">Visit order (greedy by travel time)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ol className="list-decimal space-y-1 pl-4">
              {plan.orderedTaskIds.map((id) => {
                const t = plan.places.find((x) => x.taskId === id)
                return (
                  <li key={id}>
                    {t?.title ?? id}
                    {t?.hoursStatus === "unknown" ? (
                      <span className="ml-1 text-muted-foreground">(hours unknown)</span>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(plan?.places ?? []).map((t) => (
          <Card key={t.taskId} size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{t.displayName || "—"}</p>
              <p className="text-[12px]">
                {t.hoursStatus === "open" && (
                  <span className="text-green-600 dark:text-green-400">Open now</span>
                )}
                {t.hoursStatus === "closed" && (
                  <span className="text-red-600 dark:text-red-400">Closed — excluded from route</span>
                )}
                {t.hoursStatus === "unknown" && (
                  <span>Hours unknown — still routed if other stops qualify</span>
                )}
              </p>
              {t.hoursTag ? (
                <p className="font-mono text-[11px] leading-snug text-muted-foreground/90">
                  {t.hoursTag}
                </p>
              ) : null}
              <a
                className="inline-flex items-center gap-1 text-primary"
                href={`https://www.openstreetmap.org/#map=17/${t.lat}/${t.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in OSM <ExternalLink className="size-3" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {!plan?.places?.length && !planLoading ? (
        <p className="text-sm text-muted-foreground">
          No tasks with a place name or saved location. Add locations on tasks to see
          them here.
        </p>
      ) : null}
    </div>
  )
}
