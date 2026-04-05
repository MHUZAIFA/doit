"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, LogOut, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { WakeVoiceSettings } from "@/components/wake-voice-settings"
import { persistUserTheme } from "@/components/theme-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Me = {
  user: {
    preferences: {
      privacyMode: boolean
      wakeVoiceNameIncludes: string
      wakeGreeting: string
      wakeMusicMuted: boolean
    }
  } | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me["user"]>(null)
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const load = useCallback(async () => {
    const meR = await fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
    }).then((r) => r.json() as Promise<Me>)
    setMe(meR.user)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function togglePrivacy(checked: boolean) {
    setPrivacyLoading(true)
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ privacyMode: checked }),
      })
      if (!res.ok) throw new Error()
      toast.success(checked ? "Privacy mode on" : "Privacy mode off")
      await load()
    } catch {
      toast.error("Could not update privacy")
    } finally {
      setPrivacyLoading(false)
    }
  }

  async function onThemeChange(value: string) {
    const v = value as "light" | "dark" | "system"
    setTheme(v)
    await persistUserTheme(v)
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="space-y-10">
      <section className="mt-5 space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to dashboard
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">Settings</h1>
          <p className="mt-1 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Appearance, privacy, and wake briefing voice — greeting with local weather when allowed,
            tasks, and a productivity suggestion after sleep mode.
          </p>
        </div>
      </section>

      {mounted ? (
        <Card
          size="sm"
          className="rounded-[var(--radius-xs)] border-2 border-border ring-0 dark:border-white/10"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Appearance</CardTitle>
            <CardDescription>Theme applies across Done. on this device.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:max-w-sm">
            <Label htmlFor="theme-select">Theme</Label>
            <Select
              value={theme ?? "system"}
              onValueChange={(v) => {
                if (v) void onThemeChange(v)
              }}
            >
              <SelectTrigger id="theme-select">
                <SelectValue placeholder="System" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <span className="flex items-center gap-2">
                    <Sun className="size-4 opacity-70" aria-hidden />
                    Light
                  </span>
                </SelectItem>
                <SelectItem value="dark">
                  <span className="flex items-center gap-2">
                    <Moon className="size-4 opacity-70" aria-hidden />
                    Dark
                  </span>
                </SelectItem>
                <SelectItem value="system">
                  <span className="flex items-center gap-2">
                    <Monitor className="size-4 opacity-70" aria-hidden />
                    System
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : null}

      <Card
        size="sm"
        className="rounded-[var(--radius-xs)] border-2 border-border ring-0 dark:border-white/10"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Privacy</CardTitle>
          <CardDescription>Controls AI features and title encryption behavior.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start gap-3">
          <Checkbox
            id="privacy"
            checked={Boolean(me?.preferences.privacyMode)}
            disabled={privacyLoading || !me}
            onCheckedChange={(v) => togglePrivacy(v === true)}
          />
          <Label htmlFor="privacy" className="text-sm font-normal leading-snug text-muted-foreground">
            Privacy mode — skip external AI; encrypt titles when an encryption key is set.
          </Label>
        </CardContent>
      </Card>

      {me ? (
        <WakeVoiceSettings
          wakeVoiceNameIncludes={me.preferences.wakeVoiceNameIncludes}
          wakeGreeting={me.preferences.wakeGreeting}
          wakeMusicMuted={Boolean(me.preferences.wakeMusicMuted)}
          onSaved={load}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Loading preferences…</p>
      )}

      <Card
        size="sm"
        className="rounded-[var(--radius-xs)] border-2 border-border ring-0 dark:border-white/10"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Account</CardTitle>
          <CardDescription>Sign out on this browser. You can sign in again anytime.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
            <LogOut className="mr-2 size-4" aria-hidden />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <div className="pb-4">
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
