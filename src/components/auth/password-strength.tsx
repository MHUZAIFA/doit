"use client"

import { cn } from "@/lib/utils"

export type StrengthLevel = "weak" | "fair" | "good" | "strong"

export function getPasswordStrength(password: string): {
  level: StrengthLevel
  score: number
  hint: string
} {
  if (!password) {
    return { level: "weak", score: 0, hint: "Use at least 8 characters." }
  }

  let raw = 0
  if (password.length > 0) raw++
  if (password.length >= 4) raw++
  if (password.length >= 8) raw++
  if (password.length >= 12) raw++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) raw++
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) raw++

  const score = Math.min(4, raw)
  if (score <= 1) {
    return { level: "weak", score, hint: "Keep typing — aim for 8+ characters and mixed types." }
  }
  if (score === 2) {
    return { level: "fair", score, hint: "Add length, numbers, or symbols." }
  }
  if (score === 3) {
    return { level: "good", score, hint: "Good password for this account." }
  }
  return { level: "strong", score, hint: "Strong password." }
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { level, score, hint } = getPasswordStrength(password)
  const segments = 4

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1" role="status" aria-live="polite" aria-label={`Password strength: ${level}`}>
        {Array.from({ length: segments }, (_, i) => {
          const filled = i < score
          return (
            <div
              key={i}
              className={cn(
                "h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-200",
                !filled && "bg-zinc-200 dark:bg-white/15",
                filled && level === "weak" && "bg-red-500 dark:bg-red-500/90",
                filled && level === "fair" && "bg-amber-500 dark:bg-amber-500/90",
                filled && level === "good" && "bg-zinc-500 dark:bg-zinc-400",
                filled && level === "strong" && "bg-emerald-500 dark:bg-emerald-500/90"
              )}
            />
          )
        })}
      </div>
      <p className="text-[12px] text-muted-foreground">{hint}</p>
    </div>
  )
}
