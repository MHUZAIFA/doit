"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Separator } from "@/components/ui/separator"

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
      toast.success("Fields filled from NLP")
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
        toast.error("Could not save task")
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

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New task</h1>
        <p className="text-muted-foreground">Manual fields or natural language.</p>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base">Natural language</CardTitle>
          <CardDescription>
            Describe what you need done; AI fills the form (requires API keys unless privacy mode).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g. Dentist downtown tomorrow 3pm for 45 minutes, high priority"
            value={nlp}
            onChange={(e) => setNlp(e.target.value)}
            rows={4}
          />
          <Button type="button" variant="secondary" disabled={parsing} onClick={parseNlp}>
            {parsing ? "Parsing…" : "Parse with AI"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                if (v) setCategory(v)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["work", "personal", "health", "errand", "other"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={priority}
              onValueChange={(v) => {
                if (v === "low" || v === "medium" || v === "high") setPriority(v)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loc">Location name</Label>
          <Input
            id="loc"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lat">Latitude</Label>
            <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lng">Longitude</Label>
            <Input id="lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dur">Duration (minutes)</Label>
            <Input
              id="dur"
              type="number"
              min={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save task"}
        </Button>
      </form>
    </div>
  )
}
