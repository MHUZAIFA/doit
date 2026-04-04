"use client"

import Link from "next/link"

import { siteFooterMainBottomInset } from "@/components/site-footer"
import { ThemeToggle } from "@/components/theme-toggle"

/** Matches Tailwind `h-14` (3.5rem) for fixed header/footer bars */
const BAR_OFFSET = "3.5rem"

export function AuthPageShell({
  children,
  title,
  description,
  alternateAuth,
}: {
  children: React.ReactNode
  title: string
  description: string
  /** e.g. "Create account" link row shown under the form area */
  alternateAuth?: React.ReactNode
}) {
  return (
    <div className="h-dvh overflow-hidden bg-background">
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between bg-background px-6 md:px-10">
        <Link
          href="/"
          className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Done.
        </Link>
        <div className="flex items-center gap-4">
          {alternateAuth}
          <ThemeToggle />
        </div>
      </header>

      <main
        className={`fixed left-0 right-0 z-0 overflow-y-auto overscroll-y-contain bg-background ${siteFooterMainBottomInset}`}
        style={{ top: BAR_OFFSET }}
      >
        <div className="flex min-h-full flex-col justify-center px-6 py-10 md:px-10">
          <div className="mx-auto w-full max-w-[420px]">
            <div className="mb-8">
              <h1 className="text-2xl font-medium tracking-tight text-foreground md:text-[1.75rem]">
                {title}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
