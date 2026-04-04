"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Mic, Timer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { TaskLocationPicker } from "@/components/task-location-picker"
import { TaskVoiceHeyFriday } from "@/components/task-voice-hey-friday"
import { textImpliesClearForm } from "@/lib/task-parse-utils"

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

export default function NewTaskClientPage() {
  const router = useRouter()
  const [nlp, setNlp] = useState("")
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false)
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
      if (!text) {
        setVoiceDialogOpen(false)
        return
      }

      if (textImpliesClearForm(text)) {
        clearFormState()
        setNlp("")
        setVoiceDialogOpen(false)
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
        setVoiceDialogOpen(false)
      }
    },
    [
      clearFormState,
      hasFormSnapshot,
      title,
      description,
      category,
      locationName,
      lat,
      lng,
      deadline,
      durationMinutes,
      priority,
    ]
  )

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

  const formLocked = true

  return (
    <div className="w-full max-w-none space-y-6 pb-8">
      <div className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">New task</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Mic className="size-2.5 opacity-80" aria-hidden />
            Voice only
          </span>
        </div>
        <p className="text-[14px] text-muted-foreground">
          Say &quot;Hey Friday&quot; — your words appear in a popup and the form fills when you pause.
        </p>
      </div>

      <TaskVoiceHeyFriday
        autoStart
        hideControls
        hideStatusStrip
        disabled={saving}
        onWakeDetected={() => setVoiceDialogOpen(true)}
        onEmptyCapture={() => setVoiceDialogOpen(false)}
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

      <Dialog
        open={voiceDialogOpen}
        onOpenChange={(open) => {
          if (!open && !parsing) setVoiceDialogOpen(false)
        }}
      >
        <DialogContent
          className="max-w-[min(100vw-2rem,28rem)] gap-3 sm:max-w-lg"
          showCloseButton={!parsing}
        >
          <DialogHeader>
            <DialogTitle>Hey Friday</DialogTitle>
            <DialogDescription className="text-[13px]">
              {parsing ? "Updating the form…" : "Speak your task — pause when you’re done."}
            </DialogDescription>
          </DialogHeader>
          <div
            className="max-h-[min(40vh,220px)] min-h-[100px] overflow-auto rounded-lg border border-border/80 bg-muted/25 p-4 text-[15px] leading-relaxed"
            aria-live="polite"
          >
            {parsing ? (
              <p className="text-muted-foreground">Applying to the form…</p>
            ) : nlp.trim() ? (
              <p className="whitespace-pre-wrap text-foreground">{nlp}</p>
            ) : (
              <p className="text-muted-foreground">Say your task after the greeting…</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <form onSubmit={save} className="w-full space-y-5">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="title" className="text-[11px] text-muted-foreground">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              readOnly={formLocked}
              tabIndex={-1}
              required
              placeholder="Filled by voice"
              className="h-9 bg-muted/30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description" className="text-[11px] text-muted-foreground">
              Notes
            </Label>
            <Textarea
              id="description"
              value={description}
              readOnly={formLocked}
              tabIndex={-1}
              placeholder="Optional — from voice"
              rows={3}
              className="min-h-[72px] resize-none bg-muted/30 text-[13px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Category</Label>
            <Select
              value={category}
              disabled={formLocked}
              onValueChange={(v) => {
                if (v) setCategory(v)
              }}
            >
              <SelectTrigger className="h-9 w-full min-w-0 bg-muted/30">
                <SelectValue placeholder="Category" />
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
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Priority</Label>
            <Select
              value={priority}
              disabled={formLocked}
              onValueChange={(v) => {
                if (v === "low" || v === "medium" || v === "high") setPriority(v)
              }}
            >
              <SelectTrigger className="h-9 w-full min-w-0 bg-muted/30">
                <SelectValue placeholder="Priority" />
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
          <div className="space-y-1">
            <Label
              htmlFor="dur"
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <Timer className="size-3 opacity-70" aria-hidden />
              Minutes <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dur"
              type="number"
              min={15}
              value={durationMinutes}
              readOnly={formLocked}
              tabIndex={-1}
              className="h-9 bg-muted/30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="deadline" className="text-[11px] text-muted-foreground">
              Deadline
            </Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadline}
              readOnly={formLocked}
              tabIndex={-1}
              className="h-9 min-w-0 bg-muted/30"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="size-3 opacity-70" aria-hidden />
            Place
          </Label>
          <p className="text-[10px] text-muted-foreground">Set by voice when you mention a location</p>
          <TaskLocationPicker
            compactRow
            geolocationDisabled={saving}
            locationName={locationName}
            lat={lat}
            lng={lng}
            disabled={formLocked || saving}
            onChange={({ locationName: n, lat: la, lng: ln }) => {
              setLocationName(n)
              setLat(la)
              setLng(ln)
            }}
          />
        </div>

        <div className="border-t border-border pt-4 dark:border-white/10">
          <Button type="submit" className="h-10 w-full" disabled={saving || !canSave}>
            {saving ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </div>
  )
}
