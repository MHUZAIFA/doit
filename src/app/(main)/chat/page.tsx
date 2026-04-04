"use client"

import { useRef, useState } from "react"
import { Mic, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

type Msg = { role: "user" | "assistant"; text: string }

type WebSpeechRec = {
  lang: string
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((ev: { results: Array<Array<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Ask about scheduling, priorities, or time blocking." },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<WebSpeechRec | null>(null)

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages((m) => [...m, { role: "user", text: trimmed }])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error("Chat failed")
        return
      }
      setMessages((m) => [...m, { role: "assistant", text: data.reply ?? "" }])
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  function toggleVoice() {
    if (typeof window === "undefined") return
    const w = window as typeof window & {
      SpeechRecognition?: new () => WebSpeechRec
      webkitSpeechRecognition?: new () => WebSpeechRec
    }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) {
      toast.message("Voice input not supported in this browser")
      return
    }
    if (listening && recRef.current) {
      recRef.current.stop()
      setListening(false)
      return
    }
    const rec = new SR()
    rec.lang = "en-US"
    rec.interimResults = false
    rec.onresult = (ev) => {
      const t = ev.results[0]?.[0]?.transcript ?? ""
      setInput(t)
      void send(t)
    }
    rec.onerror = () => {
      setListening(false)
      toast.error("Speech error")
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
    toast.message("Listening…")
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI chat</h1>
        <p className="text-muted-foreground">Text or voice (browser speech-to-text).</p>
      </div>

      <Card className="flex min-h-[420px] flex-col">
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <ScrollArea className="h-64 rounded-md border bg-muted/20 p-3">
            <ul className="space-y-3 text-sm">
              {messages.map((m, i) => (
                <li
                  key={`${i}-${m.text.slice(0, 12)}`}
                  className={m.role === "user" ? "text-right" : "text-left"}
                >
                  <span
                    className={
                      m.role === "user"
                        ? "inline-block rounded-lg bg-primary px-3 py-1.5 text-primary-foreground"
                        : "inline-block rounded-lg bg-muted px-3 py-1.5"
                    }
                  >
                    {m.text}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Textarea
              className="min-h-[80px] flex-1"
              placeholder="Message Done.…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
            />
            <div className="flex shrink-0 flex-col gap-2">
              <Button
                type="button"
                disabled={loading || !input.trim()}
                onClick={() => send(input)}
              >
                <Send className="mr-2 size-4" />
                Send
              </Button>
              <Button type="button" variant="outline" onClick={toggleVoice}>
                <Mic className="mr-2 size-4" />
                {listening ? "Stop" : "Voice"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
