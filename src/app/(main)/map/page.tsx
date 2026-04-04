import { MapClient } from "./map-client"

export default function MapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Map & routes</h1>
        <p className="text-muted-foreground">
          OpenStreetMap tiles, Nominatim search, Overpass opening hours, and
          OpenRouteService for stop order and paths — no Google Maps.
        </p>
      </div>
      <MapClient />
    </div>
  )
}
