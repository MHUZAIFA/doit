"use client"

import { useEffect, useState } from "react"
import { CloudSun, MapPin, MapPinOff } from "lucide-react"

type WeatherPayload = {
  description: string
  tempC: number
  feelsLikeC: number
  code: number
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; weather: WeatherPayload; placeLabel: string | null }
  | { status: "denied" }
  | { status: "error"; message: string }

/** Local weather line for the dashboard hero (after the subtitle). */
export function DashboardWeather() {
  const [state, setState] = useState<LoadState>({ status: "loading" })

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "error", message: "Location is not available in this browser." })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        void (async () => {
          const [weatherRes, placeRes] = await Promise.all([
            fetch(
              `/api/weather/current?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
              { credentials: "same-origin" }
            ),
            fetch("/api/osm/reverse", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat, lng: lon }),
            }),
          ])

          if (!weatherRes.ok) {
            if (weatherRes.status === 503) {
              setState({
                status: "error",
                message: "Weather is not configured on the server (OpenWeather API key).",
              })
              return
            }
            setState({ status: "error", message: "Could not load weather." })
            return
          }

          const w = (await weatherRes.json()) as WeatherPayload
          let placeLabel: string | null = null
          if (placeRes.ok) {
            const place = (await placeRes.json()) as { displayName?: string }
            if (typeof place.displayName === "string" && place.displayName.trim()) {
              placeLabel = place.displayName.trim()
            }
          }
          setState({ status: "ready", weather: w, placeLabel })
        })()
      },
      () => setState({ status: "denied" }),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 }
    )
  }, [])

  return (
    <div className="pt-1" aria-live="polite">
      {state.status === "loading" ? (
        <p className="animate-pulse text-xs leading-normal text-muted-foreground">
          Getting local weather…
        </p>
      ) : state.status === "denied" ? (
        <p className="flex items-center gap-2 text-xs leading-normal text-muted-foreground">
          <MapPinOff className="size-3.5 shrink-0 opacity-70" aria-hidden />
          <span>Allow location to see temperature here.</span>
        </p>
      ) : state.status === "error" ? (
        <p className="text-xs leading-normal text-muted-foreground">{state.message}</p>
      ) : (
        <div className="space-y-1.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-normal">
            <CloudSun className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="font-medium tabular-nums text-foreground">
              {Math.round(state.weather.tempC)}°C
            </span>
            <span className="text-muted-foreground">
              feels like {Math.round(state.weather.feelsLikeC)}°C
            </span>
            <span className="capitalize text-muted-foreground">· {state.weather.description}</span>
          </p>
          {state.placeLabel ? (
            <p className="flex items-center gap-2 text-xs leading-normal text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span>{state.placeLabel}</span>
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
