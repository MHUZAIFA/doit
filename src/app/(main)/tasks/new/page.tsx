"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Sparkles, Timer } from "lucide-react"
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

  async function parseNlp() {
    if (!nlp.trim()) return
    setParsing(true)
    try {
      const res = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlp }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error("Could not parse text")
        return
      }
      const f = data.fields
      setTitle(f.title ?? "")
      setDescription(f.description ?? "")
      setCategory(f.category ?? "other")
      setLocationName(f.locationName ?? "")
      setDurationMinutes(f.durationMinutes ?? 60)
      setPriority(f.priority ?? "medium")
      if (f.deadlineIso) {
        const d = new Date(f.deadlineIso)
        setDeadline(d.toISOString().slice(0, 16))
      }
      toast.success("Form updated from your description")
    } catch {
      toast.error("Network error")
    } finally {
      setParsing(false)
    }
  }

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
        className="rounded-[var(--radius-xs)] border-2 border-border ring-0 dark:border-white/10"
      >
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-[var(--radius-xs)] bg-muted dark:bg-white/10">
              <Sparkles className="size-4 text-foreground" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base font-medium">Describe it in plain language</CardTitle>
              <CardDescription className="text-[13px] leading-relaxed">
                Works when API keys are configured and privacy mode is off. Parsed fields appear in
                the form below—you can edit before saving.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g. Dentist downtown tomorrow 3pm for 45 minutes, high priority"
            value={nlp}
            onChange={(e) => setNlp(e.target.value)}
            rows={4}
            className="min-h-[108px] resize-y"
            aria-label="Natural language task description"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={parsing || !nlp.trim()}
              onClick={parseNlp}
              className="gap-2"
            >
              <Sparkles className="size-3.5 opacity-70" aria-hidden />
              {parsing ? "Parsing…" : "Fill form from text"}
            </Button>
            <span className="text-[12px] text-muted-foreground">Or skip and use the form only.</span>
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
