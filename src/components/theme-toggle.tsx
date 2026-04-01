"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

async function persistTheme(theme: "light" | "dark" | "system") {
  try {
    await fetch("/api/users/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    })
  } catch {
    /* guest or offline */
  }
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const icon =
    theme === "dark" ? (
      <Moon className="size-4" />
    ) : theme === "light" ? (
      <Sun className="size-4" />
    ) : (
      <Monitor className="size-4" />
    )

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className={buttonVariants({ variant: "outline", size: "icon", className: "size-8" })}
        aria-label="Theme"
      >
        <Sun className="size-4" />
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "outline", size: "icon", className: "size-8" })}
        aria-label="Toggle theme"
      >
        {icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem
          onClick={async () => {
            setTheme("light")
            await persistTheme("light")
          }}
        >
          <Sun className="mr-2 size-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            setTheme("dark")
            await persistTheme("dark")
          }}
        >
          <Moon className="mr-2 size-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            setTheme("system")
            await persistTheme("system")
          }}
        >
          <Monitor className="mr-2 size-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
