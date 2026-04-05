import { MapSection } from "./map-dynamic"

export default function MapPage() {
  return (
    <div className="space-y-8">
      <div className="w-full space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Map & routes</h1>
        <p className="w-full text-justify text-xs leading-relaxed text-muted-foreground">
          Pick a day: with a saved schedule, the map shows only that plan&apos;s stops in order.
          Otherwise only tasks due on that calendar day (undated tasks need a schedule for that day).
          OpenStreetMap, Nominatim, Overpass hours, and OpenRouteService — no Google Maps.
        </p>
      </div>
      <MapSection />
    </div>
  )
}
