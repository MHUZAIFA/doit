"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { useOnline } from "@/lib/hooks/use-online"

export function OfflineToastListener() {
  const online = useOnline()
  const prev = useRef<boolean | null>(null)

  useEffect(() => {
    if (prev.current === null) {
      prev.current = online
      if (!online) {
        toast.warning("You're offline", {
          description:
            "Cached views may be available; changes will sync when you reconnect.",
          duration: 8000,
        })
      }
      return
    }
    if (prev.current === online) return
    prev.current = online
    if (!online) {
      toast.warning("You're offline", {
        description:
          "Cached views may be available; changes will sync when you reconnect.",
        duration: 8000,
      })
    } else {
      toast.success("Back online")
    }
  }, [online])

  return null
}
