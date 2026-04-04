import Link from "next/link"

import { siteFooterScrollPadding } from "@/components/site-footer"

export default function PrivacyPage() {
  return (
    <div className={`min-h-full bg-background px-6 py-12 md:px-10 ${siteFooterScrollPadding}`}>
      <div className="mx-auto max-w-xl">
        <Link
          href="/register"
          className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back
        </Link>
        <h1 className="mt-8 text-2xl font-medium tracking-tight">Privacy Policy</h1>
        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
          This is a placeholder. Describe what you collect (account data, tasks, AI prompts sent to
          providers), retention, subprocessors (e.g. MongoDB, Vercel, xAI/OpenAI), and user rights.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Sessions use HTTP-only cookies. Configure encryption keys and privacy mode in the app where
          applicable.
        </p>
      </div>
    </div>
  )
}
