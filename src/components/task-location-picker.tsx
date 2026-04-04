"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const TaskLocationMapPreviewLazy = dynamic(
  () =>
    import("./task-location-map-preview").then((m) => m.TaskLocationMapPreview),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[min(220px,40vh)] w-full animate-pulse rounded-lg bg-muted/80"
        aria-hidden
      />
    ),
  }
)

type SearchHit = {
  displayName: string
  lat: number
  lon: number
  osmType: "node" | "way" | "relation" | null
  osmId: number | null
}

type TaskLocationPickerProps = {
  locationName: string
  lat: string
  lng: string
  onChange: (next: { locationName: string; lat: string; lng: string }) => void
  /** Disables search input, place label, and clear — not GPS unless {@link geolocationDisabled} is set. */
  disabled?: boolean
  /** When true, disables only the “Use my location” button (e.g. while submitting). */
  geolocationDisabled?: boolean
  /** GPS, search, and place label in one row on large screens. */
  compactRow?: boolean
}

export function TaskLocationPicker({
  locationName,
  lat,
  lng,
  onChange,
  disabled,
  geolocationDisabled = false,
  compactRow = false,
}: TaskLocationPickerProps) {
  const listId = useId()
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [listOpen, setListOpen] = useState(false)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) setListOpen(false)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [])

  const runSearch = useCallback((q: string) => {
    const t = q.trim()
    if (t.length < 2) {
      setHits([])
      return
    }
    setSearchLoading(true)
    fetch(`/api/osm/search?q=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d: { results?: SearchHit[] }) => {
        setHits(Array.isArray(d.results) ? d.results : [])
        setListOpen(true)
      })
      .catch(() => setHits([]))
      .finally(() => setSearchLoading(false))
  }, [])

  function onSearchChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(value), 400)
  }

  function pickHit(h: SearchHit) {
    setListOpen(false)
    setQuery("")
    setHits([])
    onChange({
      locationName: h.displayName,
      lat: String(h.lat),
      lng: String(h.lon),
    })
    toast.success("Location set")
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not supported in this browser.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude
        const ln = pos.coords.longitude
        try {
          const res = await fetch("/api/osm/reverse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: la, lng: ln }),
          })
          const data = await res.json()
          if (!res.ok) {
            toast.error(
              typeof data.error === "string" ? data.error : "Could not resolve address"
            )
            setLocating(false)
            return
          }
          const displayName =
            typeof data.displayName === "string" && data.displayName
              ? data.displayName
              : "Current location"
          onChange({
            locationName: displayName,
            lat: String(data.lat ?? la),
            lng: String(data.lon ?? ln),
          })
          toast.success("Location set from GPS")
        } catch {
          toast.error("Network error")
        } finally {
          setLocating(false)
        }
      },
      () => {
        setLocating(false)
        toast.error("Location access was denied or unavailable.")
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    )
  }

  function clearLocation() {
    onChange({ locationName: "", lat: "", lng: "" })
    setQuery("")
    setHits([])
    setListOpen(false)
  }

  const hasCoords = Boolean(lat.trim() && lng.trim())
  const latParsed = parseFloat(lat.trim())
  const lngParsed = parseFloat(lng.trim())
  const showMapPreview =
    hasCoords &&
    Number.isFinite(latParsed) &&
    Number.isFinite(lngParsed) &&
    Math.abs(latParsed) <= 90 &&
    Math.abs(lngParsed) <= 180

  const searchColumn = (
    <div ref={searchRef} className={cn("relative space-y-2", compactRow && "min-w-0 flex-1 space-y-1")}>
      <Label
        htmlFor="loc-search"
        className={cn(
          "font-medium text-muted-foreground",
          compactRow ? "text-[11px]" : "text-[12px]"
        )}
      >
        Search places
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="loc-search"
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => hits.length > 0 && setListOpen(true)}
          disabled={disabled}
          placeholder="Business, address, neighborhood…"
          className={cn("pl-9", compactRow && "h-9")}
          autoComplete="off"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
        />
        {searchLoading ? (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>
      {listOpen && hits.length > 0 ? (
        <ul
          id={listId}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius-xs)] border-2 border-border bg-popover py-1 text-sm shadow-md dark:border-white/10"
        >
          {hits.map((h, i) => (
            <li key={`${h.lat}-${h.lon}-${i}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted"
                onClick={() => pickHit(h)}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="leading-snug">{h.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )

  const placeColumn = (
    <div className={cn("space-y-2", compactRow && "min-w-0 flex-1 space-y-1")}>
      <Label
        htmlFor="loc-name"
        className={cn(
          "font-medium text-muted-foreground",
          compactRow ? "text-[11px]" : "text-[12px]"
        )}
      >
        {compactRow ? "Place label" : "Place label (saved on the task)"}
      </Label>
      <Input
        id="loc-name"
        value={locationName}
        onChange={(e) => onChange({ locationName: e.target.value, lat, lng })}
        disabled={disabled}
        placeholder="e.g. Client office, Gym, Home"
        className={cn(compactRow && "h-9 bg-muted/30")}
      />
      {!compactRow ? (
        <p className="text-[12px] text-muted-foreground">
          Edit the label anytime. Pick a search result or GPS to attach a map position in the background.
        </p>
      ) : null}
    </div>
  )

  const statusRow =
    locationName.trim() || hasCoords ? (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xs border-2 border-dashed border-border px-3 py-2 dark:border-white/15">
          <div className="min-w-0 text-[12px] text-muted-foreground">
            {hasCoords ? (
              <span>Map position saved — coordinates are stored for routing only.</span>
            ) : (
              <span>No map position yet — search or use my location.</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 text-muted-foreground"
            disabled={disabled}
            onClick={clearLocation}
          >
            <X className="size-3.5" aria-hidden />
            Clear location
          </Button>
        </div>
        {showMapPreview ? (
          <div className="overflow-hidden rounded-lg" aria-label="Location on map">
            <TaskLocationMapPreviewLazy
              lat={latParsed}
              lng={lngParsed}
              label={locationName.trim() || undefined}
            />
          </div>
        ) : null}
      </div>
    ) : null

  const gpsButton = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn("gap-2", compactRow && "h-9 whitespace-nowrap")}
      disabled={
        locating ||
        geolocationDisabled ||
        Boolean(disabled && !compactRow)
      }
      onClick={useMyLocation}
    >
      {locating ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Crosshair className="size-3.5" aria-hidden />
      )}
      Use my location
    </Button>
  )

  if (compactRow) {
    return (
      <div className="space-y-3">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:gap-2">
          {searchColumn}
          {placeColumn}
          <div className="flex shrink-0 justify-start lg:ml-auto lg:justify-end">{gpsButton}</div>
        </div>
        {statusRow}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {gpsButton}
        <span className="text-[12px] text-muted-foreground">
          Address comes from OpenStreetMap (Nominatim); you never need latitude or longitude.
        </span>
      </div>

      {searchColumn}

      {placeColumn}

      {statusRow}
    </div>
  )
}
