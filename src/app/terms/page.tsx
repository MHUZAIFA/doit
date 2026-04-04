import Link from "next/link"

import { siteFooterScrollPadding } from "@/components/site-footer"

export default function TermsPage() {
  return (
    <div className={`min-h-full bg-background px-6 py-12 md:px-10 ${siteFooterScrollPadding}`}>
      <div className="mx-auto max-w-xl">
        <Link
          href="/register"
          className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back
        </Link>
        <h1 className="mt-8 text-2xl font-medium tracking-tight">Terms of Service</h1>
        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
          This is a placeholder summary. Before production use, replace this page with terms reviewed by
          your legal counsel. Done. is provided as-is for productivity and scheduling; you are responsible
          for your data, API keys, and compliance with laws that apply to you.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          By creating an account you acknowledge these placeholders and agree to use the product
          responsibly.
        </p>
      </div>
    </div>
  )
}
