"use client"

import { ChevronDown } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type FormDropdownOption = { value: string; label: string }

type FormDropdownSelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: readonly FormDropdownOption[]
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  /** Applied to the trigger button */
  triggerClassName?: string
}

/**
 * Single-select dropdown using shadcn DropdownMenu + radio items (clear focus ring, full-width trigger).
 */
export function FormDropdownSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  id,
  className,
  triggerClassName,
}: FormDropdownSelectProps) {
  const selected = options.find((o) => o.value === value)

  return (
    <div className={cn("w-full min-w-0", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xs border-2 border-input bg-transparent px-3 text-left text-sm font-normal shadow-none transition-colors outline-none select-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-input/30 dark:hover:bg-input/50",
            !selected && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-(--anchor-width) min-w-(--anchor-width) max-h-72 overflow-y-auto p-1"
          align="start"
        >
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(v) => {
              if (typeof v === "string") onValueChange(v)
            }}
          >
            {options.map((o) => (
              <DropdownMenuRadioItem
                key={o.value}
                value={o.value}
                closeOnClick
                className="cursor-pointer"
              >
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
