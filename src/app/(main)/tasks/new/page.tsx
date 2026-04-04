"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Mic, Sparkles, Timer, Wand2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TaskLocationPicker } from "@/components/task-location-picker"
import { TaskVoiceHeyFriday } from "@/components/task-voice-hey-friday"
import { textImpliesClearForm } from "@/lib/task-parse-utils"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "health", label: "Health" },
  { value: "errand", label: "Errand" },
  { value: "other", label: "Other" },
] as const

const PRIORITIES = [
  { value: "low" as const, label: "Low" },
  { value: "medium" as const, label: "Medium" },
  { value: "high" as const, label: "High" },
]

function SectionTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground",
        className
      )}
    >
      {children}
    </h2>
  )
}

export default function NewTaskPage() {
  const router = useRouter()
  const [nlp, setNlp] = useState("")
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("other")
  const [locationName, setLocationName] = useState("")
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [deadline, setDeadline] = useState("")
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium")

  const resumeHeyFridayRef = useRef<(() => Promise<void>) | null>(null)

  const clearFormState = useCallback(() => {
    setTitle("")
    setDescription("")
    setCategory("other")
    setLocationName("")
    setLat("")
    setLng("")
    setDurationMinutes(60)
    setDeadline("")
    setPriority("medium")
  }, [])

  const hasFormSnapshot = useCallback(() => {
    return Boolean(
      title.trim() ||
        description.trim() ||
        locationName.trim() ||
        lat.trim() ||
        lng.trim() ||
        deadline.trim() ||
        category !== "other" ||
        durationMinutes !== 60 ||
        priority !== "medium"
    )
  }, [
    title,
    description,
    locationName,
    lat,
    lng,
    deadline,
    category,
    durationMinutes,
    priority,
  ])

  const parseNlpFromText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text) return

      if (textImpliesClearForm(text)) {
        clearFormState()
        setNlp("")
        toast.success("Form cleared")
        return
      }

      setNlp(text)
      setParsing(true)

      const body: {
        text: string
        currentForm?: {
          title: string
          description: string
          category: string
          locationName: string
          lat: string
          lng: string
          durationMinutes: number
          deadline: string
          priority: "low" | "medium" | "high"
        }
      } = { text }

      if (hasFormSnapshot()) {
        body.currentForm = {
          title: title.trim(),
          description: description.trim(),
          category,
          locationName: locationName.trim(),
          lat: lat.trim(),
          lng: lng.trim(),
          durationMinutes,
          deadline: deadline || "",
          priority,
        }
      }

      try {
        const res = await fetch("/api/ai/parse-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error("Could not parse text")
          return
        }
        const f = data.fields as {
          clearForm?: boolean
          title?: string
          description?: string
          category?: string
          locationName?: string
          durationMinutes?: number
          deadlineIso?: string | null
          priority?: "low" | "medium" | "high"
        }

        if (f.clearForm) {
          clearFormState()
          setNlp("")
          toast.success("Form cleared")
          return
        }

        setTitle(f.title ?? "")
        setDescription(f.description ?? "")
        setCategory(f.category ?? "other")
        setLocationName(f.locationName ?? "")
        setDurationMinutes(f.durationMinutes ?? 60)
        setPriority(f.priority ?? "medium")
        if (f.deadlineIso) {
          const d = new Date(f.deadlineIso)
          setDeadline(d.toISOString().slice(0, 16))
        } else {
          setDeadline("")
        }
        toast.success("Form updated from your description")
      } catch {
        toast.error("Network error")
      } finally {
        setParsing(false)
      }
    },
    [clearFormState, hasFormSnapshot, title, description, category, locationName, lat, lng, deadline, durationMinutes, priority]
  )

  const parseNlp = useCallback(() => {
    void parseNlpFromText(nlp)
  }, [nlp, parseNlpFromText])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const location: { name: string; coordinates?: { lat: number; lng: number } } = {
        name: locationName,
      }
      if (lat && lng) {
        const la = parseFloat(lat)
        const ln = parseFloat(lng)
        if (!Number.isNaN(la) && !Number.isNaN(ln)) {
          location.coordinates = { lat: la, lng: ln }
        }
      }
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          category,
          location,
          durationMinutes,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          priority,
        }),
      })
      if (!res.ok) {
        toast.error("Could not create task")
        return
      }
      toast.success("Task created")
      router.push("/dashboard")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  const latT = lat.trim()
  const lngT = lng.trim()
  const coordsValid =
    (!latT && !lngT) ||
    (latT &&
      lngT &&
      !Number.isNaN(parseFloat(latT)) &&
      !Number.isNaN(parseFloat(lngT)))
  const canSave =
    title.trim().length > 0 &&
    Number.isFinite(durationMinutes) &&
    durationMinutes >= 15 &&
    coordsValid

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-4">
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to dashboard
        </Link>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Create
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">New task</h1>
          <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Start with a sentence and let AI fill the form, or enter details yourself. Title and
            duration are required; everything else is optional.
          </p>
        </div>
      </div>

      <Card
        size="sm"
        className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-black/3 dark:border-white/8 dark:bg-card dark:ring-white/4"
      >
        <div
          className="h-px bg-linear-to-r from-transparent via-violet-500/35 to-transparent dark:via-violet-400/25"
          aria-hidden
        />
        <CardHeader className="space-y-0 pb-4 pt-5">
          <div className="flex gap-4">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500/12 to-fuchsia-500/8 ring-1 ring-violet-500/10 dark:from-violet-400/15 dark:to-fuchsia-500/10 dark:ring-violet-400/15"
              aria-hidden
            >
              <Sparkles className="size-[22px] text-violet-700 dark:text-violet-300" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Describe your task
                </CardTitle>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:border-white/10">
                  <Wand2 className="size-2.5 opacity-70" aria-hidden />
                  AI
                </span>
              </div>
              <CardDescription
                className="text-[13px] leading-relaxed text-muted-foreground"
                suppressHydrationWarning
              >
                Type a sentence or use voice. Requires API keys and privacy mode off.
              </CardDescription>
              <div
                role="list"
                className="space-y-1.5 text-[13px] leading-snug text-muted-foreground"
                suppressHydrationWarning
              >
                <div role="listitem" className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-violet-500/60 dark:bg-violet-400/50" />
                  <span>
                    Say{" "}
                    <span className="font-medium text-foreground">&quot;Hey Friday&quot;</span> —
                    Friday replies, then describe the task; pause when done to parse.
                  </span>
                </div>
                <div role="listitem" className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-fuchsia-500/50 dark:bg-fuchsia-400/40" />
                  <span>Listening stays on this page so you can add another task anytime.</span>
                </div>
                <div role="listitem" className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-500/45 dark:bg-emerald-400/35" />
                  <span>
                    If the form below already has values, the AI merges your message with them. Say
                    &quot;clear form&quot; to reset everything.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 border-t border-border/60 bg-muted/20 px-4 py-5 dark:border-white/6 dark:bg-muted/10 sm:px-6">
          <div className="space-y-2">
            <Label
              htmlFor="nlp-task"
              className="text-[12px] font-medium text-muted-foreground"
            >
              What to plan
            </Label>
            <Textarea
              id="nlp-task"
              placeholder="e.g. Dentist downtown tomorrow 3pm for 45 minutes, high priority"
              value={nlp}
              onChange={(e) => setNlp(e.target.value)}
              rows={4}
              className="min-h-[120px] resize-y border-border/80 bg-background/80 text-[15px] leading-relaxed shadow-inner dark:bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Mic className="size-3 opacity-70" aria-hidden />
              Voice
            </p>
            <TaskVoiceHeyFriday
              autoStart
              disabled={saving}
              onRegisterLoopStart={(start) => {
                resumeHeyFridayRef.current = start
              }}
              onTranscript={setNlp}
              onStopWithText={(text) => {
                void parseNlpFromText(text).finally(() => {
                  void resumeHeyFridayRef.current?.()
                })
              }}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border/50 pt-4 dark:border-white/6 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={parsing || !nlp.trim()}
              onClick={parseNlp}
              className="gap-2 shadow-sm"
            >
              <Sparkles className="size-3.5 opacity-90" aria-hidden />
              {parsing ? "Parsing…" : "Fill form from text"}
            </Button>
            <p className="text-center text-[12px] text-muted-foreground sm:text-left">
              You can skip this and fill the form below by hand.
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={save} className="space-y-8">
        <div className="border-t border-border pt-8 dark:border-white/10">
          <SectionTitle className="mb-4">Task details</SectionTitle>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-[12px] font-medium text-muted-foreground">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Review Q3 budget with finance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-[12px] font-medium text-muted-foreground">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Context, links, or checklist items (optional)"
                rows={4}
                className="min-h-[100px] resize-y"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionTitle>Category & priority</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[12px] font-medium text-muted-foreground">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  if (v) setCategory(v)
                }}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-medium text-muted-foreground">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => {
                  if (v === "low" || v === "medium" || v === "high") setPriority(v)
                }}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Choose priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" aria-hidden />
            <SectionTitle className="mb-0">Location</SectionTitle>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Search OpenStreetMap by name or use your location — no latitude/longitude fields. A map
            position is stored in the background for routing.
          </p>
          <TaskLocationPicker
            locationName={locationName}
            lat={lat}
            lng={lng}
            disabled={saving}
            onChange={({ locationName: n, lat: la, lng: ln }) => {
              setLocationName(n)
              setLat(la)
              setLng(ln)
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-muted-foreground" aria-hidden />
            <SectionTitle className="mb-0">Time</SectionTitle>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dur" className="text-[12px] font-medium text-muted-foreground">
                Duration <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dur"
                type="number"
                min={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
              <p className="text-[12px] text-muted-foreground">Minimum 15 minutes.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline" className="text-[12px] font-medium text-muted-foreground">
                Deadline
              </Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="Pick date and time (optional)"
              />
              <p className="text-[12px] text-muted-foreground">Optional; uses your local timezone.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 dark:border-white/10">
          <Button type="submit" className="h-11 w-full" disabled={saving || !canSave}>
            {saving ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </div>
  )
}
