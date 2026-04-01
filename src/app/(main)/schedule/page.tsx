"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { ScheduleOptionCards, type ScheduleOptionView } from "@/components/schedule-option-cards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localDateInputValue } from "@/lib/date"

type TaskView = { id: string; title: string }

export default function SchedulePage() {
  const [date, setDate] = useState(localDateInputValue())
  const [options, setOptions] = useState<ScheduleOptionView[]>([])
  const [alerts, setAlerts] = useState<string[]>([])
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [tasks, setTasks] = useState<TaskView[]>([])
  const [loading, setLoading] = useState(false)

  const titles = Object.fromEntries(tasks.map((t) => [t.id, t.title]))

  const refresh = useCallback(async () => {
    const [sch, tsk] = await Promise.all([
      fetch(`/api/schedules?date=${date}`).then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ])
    setTasks((tsk.tasks as TaskView[]) ?? [])
    if (sch.schedule) {
      setOptions(sch.schedule.scheduleOptions ?? [])
      setAlerts(sch.schedule.alerts ?? [])
    } else {
      setOptions([])
      setAlerts([])
    }
  }, [date])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch("/api/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error("Could not generate schedule")
        return
      }
      setOptions(data.schedule?.scheduleOptions ?? [])
      setAlerts(data.schedule?.alerts ?? [])
      setAiSummary(data.schedule?.aiSummary ?? null)
      if ((data.schedule?.alerts?.length ?? 0) > 0 && (data.schedule?.scheduleOptions?.length ?? 0) === 0) {
        toast.warning("No valid schedule — check alerts")
      } else {
        toast.success("Schedule options updated")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI schedule</h1>
        <p className="text-muted-foreground">
          Rule-based engine with travel, weather, and business hours; Grok summarizes tradeoffs.
        </p>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base">Generate</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button type="button" onClick={generate} disabled={loading}>
            {loading ? "Working…" : "Generate top 3 options"}
          </Button>
        </CardContent>
      </Card>

      {aiSummary && (
        <Card size="sm" className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">AI summary</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{aiSummary}</CardContent>
        </Card>
      )}

      {alerts.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {alerts.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      )}

      <ScheduleOptionCards options={options} taskTitles={titles} />
    </div>
  )
}
