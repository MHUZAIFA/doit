"use client"

import dynamic from "next/dynamic"

const MapClient = dynamic(() => import("./map-client").then((m) => ({ default: m.MapClient })), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[min(420px,55vh)] w-full items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
})

export function MapSection() {
  return <MapClient />
}
