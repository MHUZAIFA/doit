"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  disabled?: boolean
}

export function TaskLocationPicker({
  locationName,
  lat,
  lng,
  onChange,
  disabled,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          disabled={disabled || locating}
          onClick={useMyLocation}
        >
          {locating ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="size-3.5" aria-hidden />
          )}
          Use my location
        </Button>
        <span className="text-[12px] text-muted-foreground">
          Address comes from OpenStreetMap (Nominatim); you never need latitude or longitude.
        </span>
      </div>

      <div ref={searchRef} className="relative space-y-2">
        <Label htmlFor="loc-search" className="text-[12px] font-medium text-muted-foreground">
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
            className="pl-9"
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

      <div className="space-y-2">
        <Label htmlFor="loc-name" className="text-[12px] font-medium text-muted-foreground">
          Place label (saved on the task)
        </Label>
        <Input
          id="loc-name"
          value={locationName}
          onChange={(e) =>
            onChange({ locationName: e.target.value, lat, lng })
          }
          disabled={disabled}
          placeholder="e.g. Client office, Gym, Home"
        />
        <p className="text-[12px] text-muted-foreground">
          Edit the label anytime. Pick a search result or GPS to attach a map position in the background.
        </p>
      </div>

      {locationName.trim() || hasCoords ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-xs)] border-2 border-dashed border-border px-3 py-2 dark:border-white/15">
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
      ) : null}
    </div>
  )
}
