"use client"

import { useTheme } from "next-themes"
import { TileLayer } from "react-leaflet"

const LIGHT = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
} as const

const DARK = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
} as const

/** OSM in light mode; Carto Dark Matter in dark mode (matches app theme). */
export function MapThemedTileLayer() {
  const { resolvedTheme } = useTheme()
  const tile = resolvedTheme === "dark" ? DARK : LIGHT
  return (
    <TileLayer key={tile.url} attribution={tile.attribution} url={tile.url} />
  )
}
