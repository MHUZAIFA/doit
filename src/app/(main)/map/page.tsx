import { MapClient } from "./map-client"

export default function MapPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Map & routes</h1>
        <p className="text-muted-foreground">
          Task locations, directions links, and nearest-neighbor route hints via Google Distance Matrix.
        </p>
      </div>
      <MapClient apiKey={apiKey} />
    </div>
  )
}
