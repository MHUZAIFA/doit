"use client"

import { useEffect, useMemo } from "react"
import L from "leaflet"
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet"
import "leaflet/dist/leaflet.css"

export type OsmMapPlace = {
  id: string
  lat: number
  lng: number
  title: string
  displayName?: string
  hoursStatus: "open" | "closed" | "unknown"
}

const pinIcons: Record<string, L.DivIcon> = {
  open: L.divIcon({
    className: "osm-leaflet-pin",
    html: `<div style="width:14px;height:14px;background:#16a34a;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  }),
  closed: L.divIcon({
    className: "osm-leaflet-pin",
    html: `<div style="width:14px;height:14px;background:#dc2626;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  }),
  unknown: L.divIcon({
    className: "osm-leaflet-pin",
    html: `<div style="width:14px;height:14px;background:#64748b;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  }),
}

const startIcon = L.divIcon({
  className: "osm-leaflet-pin",
  html: `<div style="width:16px;height:16px;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function FitBounds({
  places,
  routeLine,
  start,
}: {
  places: OsmMapPlace[]
  routeLine: [number, number][] | null
  start?: { lat: number; lng: number } | null
}) {
  const map = useMap()
  useEffect(() => {
    const pts: L.LatLngExpression[] = []
    for (const p of places) pts.push([p.lat, p.lng])
    if (start) pts.push([start.lat, start.lng])
    if (routeLine?.length) {
      for (const [la, ln] of routeLine) pts.push([la, ln])
    }
    if (pts.length === 0) return
    map.fitBounds(L.latLngBounds(pts), { padding: [28, 28], maxZoom: 14 })
  }, [map, places, routeLine, start])
  return null
}

type Props = {
  places: OsmMapPlace[]
  routeLine: [number, number][] | null
  start?: { lat: number; lng: number } | null
  className?: string
}

export default function OsmRoutingMap({
  places,
  routeLine,
  start,
  className,
}: Props) {
  const center = useMemo((): [number, number] => {
    if (start) return [start.lat, start.lng]
    const p = places[0]
    if (p) return [p.lat, p.lng]
    return [40.7128, -74.006]
  }, [places, start])

  return (
    <MapContainer
      center={center}
      zoom={12}
      className={className ?? "z-0 h-[min(420px,55vh)] w-full rounded-xl border ring-1 ring-foreground/10"}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds places={places} routeLine={routeLine} start={start} />
      {start ? (
        <Marker position={[start.lat, start.lng]} icon={startIcon}>
          <Popup>Your start</Popup>
        </Marker>
      ) : null}
      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pinIcons[p.hoursStatus] ?? pinIcons.unknown}
        >
          <Popup>
            <div className="min-w-[160px] text-sm">
              <p className="font-medium">{p.title}</p>
              {p.displayName ? (
                <p className="mt-1 text-[12px] text-neutral-600">{p.displayName}</p>
              ) : null}
              <p className="mt-1 text-[11px] uppercase tracking-wide text-neutral-500">
                {p.hoursStatus === "open"
                  ? "Open now"
                  : p.hoursStatus === "closed"
                    ? "Closed now"
                    : "Hours unknown"}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
      {routeLine && routeLine.length > 1 ? (
        <Polyline
          positions={routeLine}
          pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }}
        />
      ) : null}
    </MapContainer>
  )
}
