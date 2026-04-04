"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Mic,
  Sparkles,
  Timer,
} from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
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
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
] as const

const PRIORITIES = [
  { value: "low" as const, label: "Low" },
  { value: "medium" as const, label: "Medium" },
  { value: "high" as const, label: "High" },
]

const DURATION_PRESETS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hr" },
  { value: 90, label: "1.5 hr" },
  { value: 120, label: "2 hr" },
] as const

const MAX_DURATION_MINUTES = 24 * 60

const VOICE_HISTORY_MAX = 20

function deadlineToDatetimeLocal(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type VoiceHistoryItem = { id: string; text: string; at: number }

type TaskEditorProps = { mode: "create" | "edit"; taskId?: string }

export default function TaskEditorClient({ mode, taskId }: TaskEditorProps) {
  const router = useRouter()
  const [loadingInitial, setLoadingInitial] = useState(mode === "edit")
  const [loadError, setLoadError] = useState(false)
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
  const [durationMinutes, setDurationMinutes] = useState(15)
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

  useEffect(() => {
    if (mode !== "edit" || !taskId) return
    let cancelled = false
    setLoadingInitial(true)
    setLoadError(false)
    void (async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`)
        const data = (await res.json()) as {
          task?: {
            title: string
            description?: string | null
            category: string
            location: { name: string; coordinates?: { lat: number; lng: number } }
            durationMinutes: number
            deadline: string | null
            priority: "low" | "medium" | "high"
          }
        }
        if (cancelled) return
        if (!res.ok || !data.task) {
          setLoadError(true)
          toast.error("Could not load task")
          return
        }
        const task = data.task
        setTitle(task.title)
        setDescription(task.description ?? "")
        setCategory(task.category)
        setLocationName(task.location.name ?? "")
        if (task.location.coordinates) {
          setLat(String(task.location.coordinates.lat))
          setLng(String(task.location.coordinates.lng))
        } else {
          setLat("")
          setLng("")
        }
        setDurationMinutes(
          Math.max(15, Math.min(MAX_DURATION_MINUTES, task.durationMinutes ?? 15))
        )
        setDeadline(deadlineToDatetimeLocal(task.deadline))
        setPriority(task.priority)
      } catch {
        if (!cancelled) {
          setLoadError(true)
          toast.error("Could not load task")
        }
      } finally {
        if (!cancelled) setLoadingInitial(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, taskId])

  const clearFormState = useCallback(() => {
    setTitle("")
    setDescription("")
    setCategory("other")
    setLocationName("")
    setLat("")
    setLng("")
    setDurationMinutes(15)
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
        durationMinutes !== 15 ||
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
      const body = {
        title,
        description: description || undefined,
        category,
        location,
        durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 15,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        priority,
      }
      const isEdit = mode === "edit" && taskId
      const res = await fetch(isEdit ? `/api/tasks/${taskId}` : "/api/tasks", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        toast.error(isEdit ? "Could not save task" : "Could not create task")
        return
      }
      toast.success(isEdit ? "Task saved" : "Task created")
      router.push(isEdit ? "/tasks" : "/dashboard")
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
  const canSave = title.trim().length > 0 && coordsValid && durationMinutes >= 15 && durationMinutes <= MAX_DURATION_MINUTES
  const formDisabled = saving || loadingInitial
  const backHref = mode === "edit" ? "/tasks" : "/dashboard"
  const backLabel = mode === "edit" ? "Back to all tasks" : "Back to dashboard"

  if (mode === "edit" && loadingInitial) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
        <div className="space-y-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {backLabel}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">Edit task</h1>
        </div>
        <div className="flex min-h-[min(280px,45vh)] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </div>
    )
  }

  if (mode === "edit" && loadError) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
        <div className="space-y-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {backLabel}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">Edit task</h1>
          <p className="text-sm text-muted-foreground">This task could not be loaded.</p>
          <Link
            href="/tasks"
            className={cn(buttonVariants({ variant: "secondary" }), "mt-2 inline-flex")}
          >
            All tasks
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <div className="space-y-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {backLabel}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">
              {mode === "edit" ? "Edit task" : "New task"}
            </h1>
            <p className="text-[14px] leading-snug text-muted-foreground">
              {mode === "edit" ? (
                <>
                  Update title, notes, place, duration, deadline, and priority. Voice can adjust fields
                  the same way as on new task.
                </>
              ) : (
                <>
                  Say &quot;Hey Friday&quot; to start hands-free, or tap the button to open the mic — we listen
                  for your task and fill the form.
                </>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={formDisabled}
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
          className="max-w-[min(100vw-2rem,26rem)] gap-0 overflow-hidden p-0 sm:max-w-md"
          showCloseButton
        >
          <div className="bg-linear-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent px-6 pb-5 pt-6 dark:from-violet-400/8 dark:via-fuchsia-400/4">
            <div className="flex gap-4">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl bg-background/70 dark:bg-background/50",
                  !parsing && "animate-pulse"
                )}
                aria-hidden
              >
                <Mic className="size-5 text-violet-700 dark:text-violet-300" />
              </div>
              <DialogHeader className="min-w-0 flex-1 gap-2 space-y-0 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-[1.05rem] font-semibold tracking-tight">
                    Voice assistant
                  </DialogTitle>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Hey Friday
                  </span>
                </div>
                <DialogDescription className="text-[13px] leading-relaxed">
                  {parsing
                    ? "We’re sending what you said to the model and updating the form."
                    : "Speak naturally — pause when you’re done. This window only shows what the microphone hears."}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="flex max-h-[min(72vh,520px)] flex-col">
            <div className="bg-muted/25 px-6 py-3 dark:bg-muted/20">
              <div className="flex min-w-0 items-center gap-2.5 text-[13px] leading-snug">
                {parsing ? (
                  <>
                    <Loader2
                      className="size-4 shrink-0 animate-spin text-violet-600 dark:text-violet-400"
                      aria-hidden
                    />
                    <span className="text-foreground">Applying AI to the form…</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex size-2 shrink-0" aria-hidden>
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                    </span>
                    <span className="text-muted-foreground">
                      {liveTranscript.trim()
                        ? "Listening — keep talking or pause to finish"
                        : "Mic on — start speaking"}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 px-6 pb-6 pt-5">
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Live transcript
                </p>
                <div
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions text"
                  tabIndex={-1}
                  className="min-h-[112px] max-h-[min(36vh,220px)] cursor-default overflow-y-auto pr-1 text-[15px] leading-relaxed text-foreground select-text"
                >
                  {parsing ? (
                    <div className="flex items-start gap-3 text-muted-foreground">
                      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-violet-600 dark:text-violet-400" />
                      <div className="space-y-1.5">
                        <p className="font-medium text-foreground">Processing your words…</p>
                        <p className="text-[13px] leading-relaxed">
                          Parsing intent and merging into title, time, place, and priority.
                        </p>
                      </div>
                    </div>
                  ) : liveTranscript.trim() ? (
                    <p className="whitespace-pre-wrap">{liveTranscript}</p>
                  ) : (
                    <p className="text-muted-foreground">
                      Your speech appears here as text. This isn’t a typing field — use the form
                      below after you close, or keep talking.
                    </p>
                  )}
                </div>
              </div>

              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <Sparkles className="mr-1.5 inline size-3.5 -translate-y-px text-fuchsia-600 opacity-80 dark:text-fuchsia-400" />
                Close this window anytime to edit the task fields on the page.
              </p>

              {voiceHistory.length > 0 ? (
                <div className="mt-2 space-y-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Earlier in this session
                  </p>
                  <div className="flex max-h-[min(24vh,168px)] flex-col gap-5 overflow-y-auto pr-1">
                    {voiceHistory.map((item) => (
                      <div
                        key={item.id}
                        className="min-w-0 border-l-2 border-violet-500/50 py-0.5 pl-4 dark:border-violet-400/45"
                      >
                        <p className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
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
              disabled={formDisabled}
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
                  disabled={formDisabled}
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
                  disabled={formDisabled}
                  placeholder="Optional notes"
                  rows={8}
                  className="min-h-[220px] resize-y text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,8rem)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-1">
                <Label htmlFor="field-category" className="text-[11px] text-muted-foreground">
                  Category
                </Label>
                <FormDropdownSelect
                  id="field-category"
                  value={category}
                  disabled={formDisabled}
                  onValueChange={setCategory}
                  options={CATEGORIES}
                  placeholder="Category"
                  triggerClassName="h-11"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor="field-priority" className="text-[11px] text-muted-foreground">
                  Priority
                </Label>
                <FormDropdownSelect
                  id="field-priority"
                  value={priority}
                  disabled={formDisabled}
                  onValueChange={(v) => {
                    if (v === "low" || v === "medium" || v === "high") setPriority(v)
                  }}
                  options={PRIORITIES}
                  placeholder="Priority"
                  triggerClassName="h-11"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor="deadline" className="text-[11px] text-muted-foreground">
                  Deadline
                </Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={formDisabled}
                  className="h-11 min-w-0"
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Timer className="size-3 opacity-70" aria-hidden />
                  Duration
                </Label>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Optional — defaults to 15 minutes. Use presets or enter any length (15–
                  {MAX_DURATION_MINUTES} min).
                </p>
                <div className="flex w-full min-w-0 flex-nowrap items-center gap-2.5 overflow-x-auto py-0.5">
                  {DURATION_PRESETS.map((p) => {
                    const selected = durationMinutes === p.value
                    return (
                      <Button
                        key={p.value}
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={formDisabled}
                        className={cn(
                          "h-7 min-w-14 shrink-0 px-2 text-sm transition-colors",
                          selected &&
                            "border-black bg-black text-white hover:bg-black/90 hover:text-white dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
                        )}
                        onClick={() => setDurationMinutes(p.value)}
                        aria-pressed={selected}
                      >
                        {p.label}
                      </Button>
                    )
                  })}
                  <Input
                    id="dur-minutes"
                    type="number"
                    min={15}
                    max={MAX_DURATION_MINUTES}
                    value={durationMinutes}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === "") return
                      const n = Number(raw)
                      if (!Number.isFinite(n)) return
                      setDurationMinutes(n)
                    }}
                    disabled={formDisabled}
                    className="h-7 flex-1 basis-0 px-2 text-xs tabular-nums"
                    aria-label={`Duration in minutes (${15}–${MAX_DURATION_MINUTES})`}
                    placeholder="min"
                  />
                  <span className="text-xs text-muted-foreground">mins.</span>
                </div>
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
              geolocationDisabled={formDisabled}
              locationName={locationName}
              lat={lat}
              lng={lng}
              disabled={formDisabled}
              onChange={({ locationName: n, lat: la, lng: ln }) => {
                setLocationName(n)
                setLat(la)
                setLng(ln)
              }}
            />
          </div>
        </div>

        <Button type="submit" className="h-10 w-full" disabled={formDisabled || !canSave}>
            {saving
              ? mode === "edit"
                ? "Saving…"
                : "Creating…"
              : mode === "edit"
                ? "Save changes"
                : "Create task"}
          </Button>
      </form>
    </div>
  )
}
