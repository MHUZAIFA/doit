"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Route } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type TaskRow = {
  id: string
  title: string
  location: { name: string; coordinates?: { lat: number; lng: number } }
}

export function MapClient({ apiKey }: { apiKey: string }) {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [optimized, setOptimized] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: { tasks?: TaskRow[] }) => {
        if (!cancelled) setTasks(data.tasks ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function optimizeOrder() {
    const withCoords = tasks.filter((t) => t.location.coordinates)
    if (withCoords.length < 2) {
      toast.message("Add coordinates to at least two tasks")
      return
    }
    const res = await fetch("/api/maps/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: withCoords.map((t) => t.id) }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error("Optimize failed")
      return
    }
    setOptimized(data.orderedIds ?? [])
    if (data.note) toast.message(data.note)
    else toast.success("Route order updated")
  }

  const embed =
    apiKey && tasks[0]?.location.coordinates
      ? `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${tasks[0].location.coordinates.lat},${tasks[0].location.coordinates.lng}&zoom=12`
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={optimizeOrder}>
          <Route className="mr-2 size-4" />
          Optimize stop order
        </Button>
        {!apiKey && (
          <p className="text-sm text-muted-foreground">
            Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the live map embed.
          </p>
        )}
      </div>

      {embed && (
        <div className="aspect-video w-full overflow-hidden rounded-xl border ring-1 ring-foreground/10">
          <iframe title="Map" className="size-full border-0" loading="lazy" src={embed} />
        </div>
      )}

      {optimized && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base">Suggested order</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ol className="list-decimal space-y-1 pl-4">
              {optimized.map((id) => {
                const t = tasks.find((x) => x.id === id)
                return <li key={id}>{t?.title ?? id}</li>
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {tasks.map((t) => (
          <Card key={t.id} size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{t.location.name || "No address"}</p>
              {t.location.coordinates && (
                <a
                  className="inline-flex items-center gap-1 text-primary"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${t.location.coordinates.lat},${t.location.coordinates.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Directions <ExternalLink className="size-3" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
