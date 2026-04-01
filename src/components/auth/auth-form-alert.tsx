"use client"

import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"

export function AuthFormAlert({
  message,
  className,
}: {
  message: string | null
  className?: string
}) {
  if (!message) return null
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive dark:border-destructive/40 dark:bg-destructive/15",
        className
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{message}</p>
    </div>
  )
}
