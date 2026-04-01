import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"

const features = [
  {
    title: "Talk to your task list",
    lead: "Describe work in plain English. DoIt parses titles, times, places, and priority—no form fatigue.",
    detail: "Powered by Grok or OpenAI when you add API keys; sensible fallbacks when you don’t.",
  },
  {
    title: "Plans that respect the clock",
    lead: "Schedules honor business hours, travel buffers, and deadlines. See three ranked day options, not one rigid grid.",
    detail: "Weather-aware hints when coordinates are set. Alerts when nothing fits—so you can adjust, not guess.",
  },
  {
    title: "Places tied to work",
    lead: "Attach locations, get smarter stop order with Distance Matrix, and jump to directions when you’re on the move.",
    detail: "Optional map embed when you configure a public Maps key.",
  },
  {
    title: "Your pace, your rules",
    lead: "Light & dark themes synced to your account, reminders, streaks, and privacy mode when you want less cloud processing.",
    detail: "Sessions use secure cookies. Encrypt sensitive titles when you set an encryption key.",
  },
] as const

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5 md:px-10 lg:px-12">
        <span className="text-[15px] font-medium tracking-tight">DoIt</span>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="ml-2 rounded-full px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted dark:hover:bg-white/5"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-24 pt-8 md:px-10 md:pt-14 lg:px-12 lg:pt-20">
        <div className="mx-auto w-full max-w-3xl">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Scheduling
          </p>
          <h1 className="max-w-xl text-[2.25rem] font-medium leading-[1.08] tracking-[-0.02em] sm:text-5xl sm:leading-[1.05] lg:text-[3.25rem]">
            Your day, planned with quiet precision.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-[1.65] text-muted-foreground sm:text-base">
            AI-assisted tasks, calendars that account for travel and weather, and a workspace that
            stays out of your way.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-7 text-[14px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-full px-7 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
              <ArrowUpRight className="ml-1 size-4 opacity-60" aria-hidden />
            </Link>
          </div>
        </div>

        <section
          className="mx-auto mt-28 w-full max-w-3xl border-t border-border pt-16 dark:border-white/10 lg:mt-36 lg:pt-20"
          aria-labelledby="features-heading"
        >
          <div className="mb-12 max-w-lg">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Product
            </p>
            <h2
              id="features-heading"
              className="mt-3 text-xl font-medium tracking-tight text-foreground sm:text-2xl"
            >
              Built for real schedules—not slide decks.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Four things that make DoIt feel like a tool you’ll actually open every morning.
            </p>
          </div>

          <ol className="list-none space-y-0">
            {features.map((f, index) => (
              <li
                key={f.title}
                className="border-t border-border py-10 first:border-t-0 first:pt-0 dark:border-white/[0.08] sm:py-12"
              >
                <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
                  <span
                    className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground sm:w-10"
                    aria-hidden
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-[17px] font-medium tracking-tight text-foreground sm:text-lg">
                      {f.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-muted-foreground">{f.lead}</p>
                    <p className="pt-1 text-[13px] leading-relaxed text-muted-foreground/80">
                      {f.detail}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}
