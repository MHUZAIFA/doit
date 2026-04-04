"use client"

import { useEffect } from "react"
import L from "leaflet"
import { MapContainer, Marker, Popup, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"

import { MapThemedTileLayer } from "@/components/map-themed-tile-layer"
import {
  MAP_CONTAINER_INNER_CLASS,
  MAP_PREVIEW_DEFAULT_CLASS,
} from "@/lib/task-location-map-classes"

export {
  MAP_CONTAINER_INNER_CLASS,
  MAP_PREVIEW_DEFAULT_CLASS,
  MAP_PREVIEW_FILL_CLASS,
} from "@/lib/task-location-map-classes"

function MapResizeInvalidator() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
    })
    ro.observe(el)
    map.invalidateSize()
    const id = requestAnimationFrame(() => map.invalidateSize())
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
    }
  }, [map])
  return null
}

/** Downtown Montréal — default when no task coordinates. */
export const MONTREAL_DEFAULT = { lat: 45.50884, lng: -73.56771 } as const

const pin = L.divIcon({
  className: "task-loc-map-pin",
  html: `<div style="width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

type TaskLocationMapPreviewProps = {
  /** Task coordinates — when omitted, map centers on Montréal with a default marker. */
  lat?: number
  lng?: number
  /** Shown in marker popup when non-empty */
  label?: string
  className?: string
}

function parseValidCoords(
  lat?: number,
  lng?: number
): { lat: number; lng: number } | null {
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null
  }
  return { lat, lng }
}

/**
 * Read-only map (OpenStreetMap). Uses task coordinates when valid; otherwise Montréal.
 */
export function TaskLocationMapPreview({
  lat,
  lng,
  label,
  className,
}: TaskLocationMapPreviewProps) {
  const taskCoords = parseValidCoords(lat, lng)
  const center: [number, number] = taskCoords
    ? [taskCoords.lat, taskCoords.lng]
    : [MONTREAL_DEFAULT.lat, MONTREAL_DEFAULT.lng]
  const zoom = taskCoords ? 14 : 11
  const mapKey = taskCoords
    ? `task-${taskCoords.lat}-${taskCoords.lng}`
    : "montreal-default"

  return (
    <div className={className ?? MAP_PREVIEW_DEFAULT_CLASS}>
      <MapContainer
        key={mapKey}
        center={center}
        zoom={zoom}
        className={MAP_CONTAINER_INNER_CLASS}
        scrollWheelZoom={false}
      >
        <MapResizeInvalidator />
        <MapThemedTileLayer />
        {taskCoords ? (
          <Marker position={[taskCoords.lat, taskCoords.lng]} icon={pin}>
            {label?.trim() ? <Popup>{label.trim()}</Popup> : null}
          </Marker>
        ) : (
          <Marker position={[MONTREAL_DEFAULT.lat, MONTREAL_DEFAULT.lng]} icon={pin}>
            <Popup>Montréal</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
