import { MapSection } from "./map-dynamic"

export default function MapPage() {
  return (
    <div className="space-y-8">
      <div className="w-full space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Map & routes</h1>
        <p className="text-muted-foreground leading-relaxed text-xs w-full text-justify">
          Tasks due by end of today or earlier (no future deadlines), plus open tasks with no deadline at
          the end of the route. Stops are ordered by priority and deadline; OpenStreetMap, Nominatim,
          Overpass hours, and OpenRouteService for the path — no Google Maps.
        </p>
      </div>
      <MapSection />
    </div>
  )
}
