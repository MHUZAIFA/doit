"use client"

import { useCallback, useEffect, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Bed, LogOut, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { WakeVoiceSettings } from "@/components/wake-voice-settings"
import { persistUserTheme } from "@/components/theme-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
      sleepHoursEnabled: boolean
      sleepHoursStart: string
      sleepHoursEnd: string
    }
  } | null
}

function hmFromTimeInput(value: string) {
  const m = value.match(/^(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : "09:00"
}

export default function SettingsPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me["user"]>(null)
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [sleepLoading, setSleepLoading] = useState(false)
  const [sleepTimesSaving, setSleepTimesSaving] = useState(false)
  const [sleepStart, setSleepStart] = useState("23:00")
  const [sleepEnd, setSleepEnd] = useState("07:00")
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

  useEffect(() => {
    if (!me?.preferences) return
    setSleepStart(me.preferences.sleepHoursStart ?? "23:00")
    setSleepEnd(me.preferences.sleepHoursEnd ?? "07:00")
  }, [me?.preferences?.sleepHoursStart, me?.preferences?.sleepHoursEnd])

  async function toggleSleepHours(checked: boolean) {
    setSleepLoading(true)
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ sleepHoursEnabled: checked }),
      })
      if (!res.ok) throw new Error()
      toast.success(checked ? "Sleep hours respected when scheduling" : "Sleep hours off")
      await load()
    } catch {
      toast.error("Could not update sleep hours")
    } finally {
      setSleepLoading(false)
    }
  }

  async function saveSleepTimes() {
    setSleepTimesSaving(true)
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          sleepHoursStart: hmFromTimeInput(sleepStart),
          sleepHoursEnd: hmFromTimeInput(sleepEnd),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Sleep window saved")
      await load()
    } catch {
      toast.error("Could not save sleep window")
    } finally {
      setSleepTimesSaving(false)
    }
  }

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

      <Card
        size="sm"
        className="rounded-[var(--radius-xs)] border-2 border-border ring-0 dark:border-white/10"
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Bed className="size-4 opacity-70" aria-hidden />
            Sleep hours
          </CardTitle>
          <CardDescription>
            When enabled, generated schedules skip this window (bedtime later than wake time is OK — e.g. 23:00 to
            07:00 overnight).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-start gap-3">
            <Checkbox
              id="sleep-hours"
              checked={Boolean(me?.preferences.sleepHoursEnabled)}
              disabled={sleepLoading || !me}
              onCheckedChange={(v) => toggleSleepHours(v === true)}
            />
            <Label htmlFor="sleep-hours" className="text-sm font-normal leading-snug text-muted-foreground">
              Block tasks during my sleep window
            </Label>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="sleep-start" className="text-xs text-muted-foreground">
                Sleep from
              </Label>
              <Input
                id="sleep-start"
                type="time"
                value={sleepStart.length >= 5 ? sleepStart.slice(0, 5) : sleepStart}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSleepStart(e.target.value)}
                disabled={!me}
                className="h-10 w-full sm:w-auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sleep-end" className="text-xs text-muted-foreground">
                Wake at
              </Label>
              <Input
                id="sleep-end"
                type="time"
                value={sleepEnd.length >= 5 ? sleepEnd.slice(0, 5) : sleepEnd}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSleepEnd(e.target.value)}
                disabled={!me}
                className="h-10 w-full sm:w-auto"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              disabled={!me || sleepTimesSaving}
              onClick={() => void saveSleepTimes()}
            >
              Save sleep window
            </Button>
          </div>
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
