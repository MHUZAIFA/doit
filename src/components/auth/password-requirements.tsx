"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export function PasswordRequirements({ password }: { password: string }) {
  const rules = [
    { ok: password.length >= 8, text: "At least 8 characters" },
    { ok: /[a-z]/.test(password) && /[A-Z]/.test(password), text: "Upper and lowercase letters" },
    { ok: /\d/.test(password) || /[^A-Za-z0-9]/.test(password), text: "A number or symbol" },
  ]

  return (
    <ul className="space-y-2 text-[12px]" aria-label="Password requirements">
      {rules.map((r) => (
        <li
          key={r.text}
          className={cn(
            "flex items-center gap-2.5 transition-colors",
            r.ok ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border",
              r.ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border dark:border-white/15"
            )}
            aria-hidden
          >
            {r.ok ? <Check className="size-2.5 stroke-[3]" /> : null}
          </span>
          {r.text}
        </li>
      ))}
    </ul>
  )
}
