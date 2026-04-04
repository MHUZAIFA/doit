"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Mic, Sparkles, Timer } from "lucide-react"
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
import { FormDropdownSelect } from "@/components/form-dropdown-select"
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

const VOICE_HISTORY_MAX = 20

type VoiceHistoryItem = { id: string; text: string; at: number }

export default function NewTaskClientPage() {
  const router = useRouter()
  /** Live words for the current Hey Friday session (cleared when the dialog opens again). */
  const [liveTranscript, setLiveTranscript] = useState("")
  /** Completed voice messages from earlier sessions on this page. */
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistoryItem[]>([])
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
  const startDirectCaptureRef = useRef<(() => Promise<void>) | null>(null)
  /** True when the user closed the dialog (ESC, overlay, X) — skip applying AI results. */
  const voiceDismissedRef = useRef(false)
  /** True when we close the dialog after a finished parse (not a user dismiss). */
  const parseCloseIntentRef = useRef(false)
  const parsingRef = useRef(false)
  const abortParseRef = useRef<(() => void) | null>(null)

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
        setLiveTranscript("")
        setVoiceDialogOpen(false)
        setVoiceHistory((prev) => {
          const next: VoiceHistoryItem[] = [
            ...prev,
            { id: crypto.randomUUID(), text, at: Date.now() },
          ]
          return next.slice(-VOICE_HISTORY_MAX)
        })
        toast.success("Form cleared")
        return
      }

      if (voiceDismissedRef.current) {
        voiceDismissedRef.current = false
        return
      }

      parsingRef.current = true
      setParsing(true)

      const ac = new AbortController()
      abortParseRef.current = () => {
        ac.abort()
      }

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
          signal: ac.signal,
        })
        const data = await res.json()
        if (voiceDismissedRef.current) {
          return
        }
        if (!res.ok) {
          toast.error("Could not parse text")
          return
        }
        const f = data.fields as {
          clearForm?: boolean
          updates?: {
            title?: string
            description?: string
            category?: string
            locationName?: string
            durationMinutes?: number
            deadlineIso?: string | null
            priority?: "low" | "medium" | "high"
          }
        }

        if (f.clearForm) {
          clearFormState()
          setLiveTranscript("")
          toast.success("Form cleared")
          return
        }

        const u = f.updates ?? {}
        const touched = Object.keys(u)
        if (touched.length === 0) {
          toast.message("No fields to update — say what you’d like to change.")
          return
        }

        if (u.title !== undefined) setTitle(u.title)
        if (u.description !== undefined) setDescription(u.description)
        if (u.category !== undefined) setCategory(u.category)
        if (u.locationName !== undefined) setLocationName(u.locationName)
        if (u.durationMinutes !== undefined) setDurationMinutes(u.durationMinutes)
        if (u.priority !== undefined) setPriority(u.priority)
        if (u.deadlineIso !== undefined) {
          if (u.deadlineIso) {
            const d = new Date(u.deadlineIso)
            setDeadline(d.toISOString().slice(0, 16))
          } else {
            setDeadline("")
          }
        }

        const fieldLabel: Record<string, string> = {
          title: "title",
          description: "notes",
          category: "category",
          locationName: "place",
          durationMinutes: "duration",
          deadlineIso: "deadline",
          priority: "priority",
        }
        toast.success(
          touched.length === 1
            ? `Updated ${fieldLabel[touched[0]!] ?? touched[0]}`
            : `Updated ${touched.length} fields`
        )
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return
        }
        if (e instanceof DOMException && e.name === "AbortError") {
          return
        }
        toast.error("Network error")
      } finally {
        parsingRef.current = false
        abortParseRef.current = null
        setParsing(false)
        const dismissed = voiceDismissedRef.current
        if (!dismissed) {
          parseCloseIntentRef.current = true
          setVoiceDialogOpen(false)
          if (text.trim()) {
            setVoiceHistory((prev) => {
              const next: VoiceHistoryItem[] = [
                ...prev,
                { id: crypto.randomUUID(), text, at: Date.now() },
              ]
              return next.slice(-VOICE_HISTORY_MAX)
            })
          }
        } else {
          voiceDismissedRef.current = false
        }
        setLiveTranscript("")
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <div className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">New task</h1>
            <p className="text-[14px] leading-snug text-muted-foreground">
              Say &quot;Hey Friday&quot; to start hands-free, or tap the button to open the mic — we listen
              for your task and fill the form.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={saving}
            aria-label="Open voice: speak your task with AI"
            onClick={() => {
              const run = startDirectCaptureRef.current
              if (!run) {
                toast.message("Voice isn’t ready yet — try again in a moment.")
                return
              }
              void run()
            }}
            className={cn(
              "relative h-auto min-h-9 shrink-0 gap-2 overflow-hidden rounded-full border-violet-500/45 bg-linear-to-r from-violet-500/[0.14] via-fuchsia-500/10 to-cyan-500/9 px-4 py-2 text-[13px] font-semibold tracking-tight shadow-sm shadow-violet-500/20",
              "transition-[transform,box-shadow,border-color] duration-200 hover:scale-[1.02] hover:border-violet-500/70 hover:shadow-md hover:shadow-violet-500/30",
              "dark:border-violet-400/40 dark:from-violet-400/12 dark:via-fuchsia-400/9 dark:to-cyan-400/8 dark:shadow-violet-400/15 dark:hover:border-violet-400/65 dark:hover:shadow-violet-400/25",
              "focus-visible:border-violet-500/80 focus-visible:ring-violet-500/35 dark:focus-visible:border-violet-400/70 dark:focus-visible:ring-violet-400/30"
            )}
          >
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-700 dark:bg-violet-400/18 dark:text-violet-200"
              aria-hidden
            >
              <Mic className="size-3.5" />
            </span>
            <span className="flex flex-col items-start gap-0.5 leading-none">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3 text-fuchsia-600 dark:text-fuchsia-400" aria-hidden />
                Speak with AI
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">Voice fills the form</span>
            </span>
          </Button>
        </div>
      </div>

      <Dialog
        open={voiceDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (parsingRef.current) {
              abortParseRef.current?.()
            }
            if (!parseCloseIntentRef.current) {
              voiceDismissedRef.current = true
            }
            parseCloseIntentRef.current = false
            setVoiceDialogOpen(false)
            setLiveTranscript("")
          }
        }}
      >
        <DialogContent
          className="max-w-[min(100vw-2rem,28rem)] gap-3 sm:max-w-lg"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>Hey Friday</DialogTitle>
            <DialogDescription className="text-[13px]">
              {parsing ? "Updating the form…" : "Speak your task — pause when you’re done."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[min(72vh,520px)] flex-col gap-3">
            <div
              className="min-h-[100px] max-h-[min(40vh,220px)] overflow-auto rounded-lg border border-border/80 bg-muted/25 p-4 text-[15px] leading-relaxed"
              aria-live="polite"
            >
              {parsing ? (
                <p className="text-muted-foreground">Applying to the form…</p>
              ) : liveTranscript.trim() ? (
                <p className="whitespace-pre-wrap text-foreground">{liveTranscript}</p>
              ) : (
                <p className="text-muted-foreground">Listening — your words will appear here.</p>
              )}
            </div>
            {voiceHistory.length > 0 ? (
              <div className="min-h-0 shrink-0 border-t border-border/80 pt-3 dark:border-white/10">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Earlier
                </p>
                <div className="max-h-[min(28vh,200px)] space-y-2 overflow-y-auto pr-1">
                  {voiceHistory.map((item) => (
                    <blockquote
                      key={item.id}
                      className="border-l-2 border-violet-500/40 py-1 pl-3 text-[13px] leading-snug text-muted-foreground dark:border-violet-400/35"
                    >
                      <span className="whitespace-pre-wrap">{item.text}</span>
                    </blockquote>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <form onSubmit={save} className="w-full space-y-8">
        <div className="grid gap-8 md:grid-cols-2 md:items-stretch md:gap-10">
          <div className="min-w-0 space-y-5">
            <TaskVoiceHeyFriday
              autoStart
              hideControls
              hideStatusStrip
              disabled={saving}
              onWakeDetected={() => {
                voiceDismissedRef.current = false
                parseCloseIntentRef.current = false
                setLiveTranscript("")
                setVoiceDialogOpen(true)
              }}
              onEmptyCapture={() => {
                setLiveTranscript("")
                setVoiceDialogOpen(false)
              }}
              onRegisterVoiceApi={(api) => {
                resumeHeyFridayRef.current = api.start
                startDirectCaptureRef.current = api.startDirectCapture
              }}
              onTranscript={setLiveTranscript}
              onStopWithText={(text) => {
                void parseNlpFromText(text).finally(() => {
                  void resumeHeyFridayRef.current?.()
                })
              }}
            />

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="title" className="text-[11px] text-muted-foreground">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={saving}
                  placeholder="Task title"
                  className="h-11"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="description" className="text-[11px] text-muted-foreground">
                  Notes
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                  placeholder="Optional notes"
                  rows={8}
                  className="min-h-[220px] resize-y text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="field-category" className="text-[11px] text-muted-foreground">
                  Category
                </Label>
                <FormDropdownSelect
                  id="field-category"
                  value={category}
                  disabled={saving}
                  onValueChange={setCategory}
                  options={CATEGORIES}
                  placeholder="Category"
                  triggerClassName="h-11"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="field-priority" className="text-[11px] text-muted-foreground">
                  Priority
                </Label>
                <FormDropdownSelect
                  id="field-priority"
                  value={priority}
                  disabled={saving}
                  onValueChange={(v) => {
                    if (v === "low" || v === "medium" || v === "high") setPriority(v)
                  }}
                  options={PRIORITIES}
                  placeholder="Priority"
                  triggerClassName="h-11"
                />
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
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  disabled={saving}
                  className="h-11"
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
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={saving}
                  className="h-11 min-w-0"
                />
              </div>
            </div>
          </div>

          <div className="flex min-h-[min(280px,45vh)] flex-col md:h-full md:min-h-0 md:sticky md:top-6">
            <TaskLocationPicker
              className="min-h-0 flex-1"
              compactRow
              compactTitleRow={
                <>
                  <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="size-3 opacity-70" aria-hidden />
                    Place
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Search, use GPS, or say a place when using voice
                  </p>
                </>
              }
              geolocationDisabled={saving}
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
        </div>

        <div className="border-t border-border pt-6 dark:border-white/10">
          <Button type="submit" className="h-10 w-full" disabled={saving || !canSave}>
            {saving ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </div>
  )
}
