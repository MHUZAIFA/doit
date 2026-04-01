"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

/** Applies saved theme from the user profile when signed in (server is source of truth). */
export function UserThemeBootstrap() {
  const { setTheme } = useTheme()

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { user?: { preferences?: { theme?: string } } }) => {
        if (cancelled) return
        const t = data.user?.preferences?.theme
        if (t === "light" || t === "dark" || t === "system") {
          setTheme(t)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [setTheme])

  return null
}
