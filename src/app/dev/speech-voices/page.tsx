import { notFound } from "next/navigation"

import { SpeechVoicesList } from "./speech-voices-list"

/** Lists `speechSynthesis` voices for *this* browser (dev only). No global list exists. */
export default function SpeechVoicesDevPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <h1 className="text-xl font-semibold tracking-tight">Speech synthesis voices</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        Voices come from your OS and browser — there is no universal list. This page shows what{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[13px]">speechSynthesis.getVoices()</code>{" "}
        returns here (open in Chrome, Safari, etc. to compare).
      </p>
      <div className="mt-8">
        <SpeechVoicesList />
      </div>
    </div>
  )
}
