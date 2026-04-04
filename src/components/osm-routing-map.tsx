"use client"

import { useEffect, useMemo } from "react"
import L from "leaflet"
import { useTheme } from "next-themes"
import { MapContainer, Marker, Polyline, Popup, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"

import { MapThemedTileLayer } from "@/components/map-themed-tile-layer"
import {
  MAP_CONTAINER_INNER_CLASS,
  OSM_ROUTING_MAP_FRAME_CLASS,
} from "@/lib/task-location-map-classes"

export type OsmMapPlace = {
  id: string
  lat: number
  lng: number
  title: string
  displayName?: string
  hoursStatus: "open" | "closed" | "unknown"
  /** Matches suggested-route stop color (by visit order). */
  colorHex: string
}

function taskPinIcon(colorHex: string): L.DivIcon {
  const safe = /^#[0-9a-fA-F]{6}$/.test(colorHex) ? colorHex : "#64748b"
  return L.divIcon({
    className: "osm-leaflet-pin",
    html: `<div style="width:14px;height:14px;background:${safe};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

const startIcon = L.divIcon({
  className: "osm-leaflet-pin osm-start-marker-icon",
  html: `<div class="osm-start-marker-wrap"><span class="osm-start-marker-dot location-dot-pulse" aria-hidden="true"></span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
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
  const { resolvedTheme } = useTheme()
  const routeColor = resolvedTheme === "dark" ? "#60a5fa" : "#2563eb"

  const center = useMemo((): [number, number] => {
    if (start) return [start.lat, start.lng]
    const p = places[0]
    if (p) return [p.lat, p.lng]
    return [40.7128, -74.006]
  }, [places, start])

  const pinIconsByColor = useMemo(() => {
    const m = new Map<string, L.DivIcon>()
    for (const p of places) {
      if (!m.has(p.colorHex)) m.set(p.colorHex, taskPinIcon(p.colorHex))
    }
    return m
  }, [places])

  return (
    <div className={className ?? OSM_ROUTING_MAP_FRAME_CLASS}>
      <MapContainer
        center={center}
        zoom={12}
        className={MAP_CONTAINER_INNER_CLASS}
        scrollWheelZoom
      >
        <MapThemedTileLayer />
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
          icon={pinIconsByColor.get(p.colorHex) ?? taskPinIcon(p.colorHex)}
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
                    ? "Closed now — on route; check hours"
                    : "Assumed open (24/7)"}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
      {routeLine && routeLine.length >= 2 ? (
        <Polyline
          positions={routeLine}
          pathOptions={{ color: routeColor, weight: 5, opacity: 0.85 }}
        />
      ) : null}
      </MapContainer>
    </div>
  )
}
