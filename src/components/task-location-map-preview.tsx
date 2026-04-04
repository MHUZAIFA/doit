"use client"

import L from "leaflet"
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet"
import "leaflet/dist/leaflet.css"

const pin = L.divIcon({
  className: "task-loc-map-pin",
  html: `<div style="width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

type TaskLocationMapPreviewProps = {
  lat: number
  lng: number
  /** Shown in marker popup when non-empty */
  label?: string
  className?: string
}

/**
 * Small read-only map centered on one point (OpenStreetMap tiles).
 */
export function TaskLocationMapPreview({
  lat,
  lng,
  label,
  className,
}: TaskLocationMapPreviewProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      className={
        className ??
        "z-0 h-[min(220px,40vh)] w-full overflow-hidden rounded-lg border border-border ring-1 ring-foreground/10"
      }
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={pin}>
        {label?.trim() ? <Popup>{label.trim()}</Popup> : null}
      </Marker>
    </MapContainer>
  )
}
