import Link from "next/link"

/** Fixed main (auth): inset from viewport bottom so content clears the footer */
export const siteFooterMainBottomInset =
  "max-sm:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))]"

/** Flowing layouts: padding-bottom so scrollable content clears the fixed footer */
export const siteFooterScrollPadding =
  "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))]"

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-50 bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex w-full px-10 flex-col justify-center gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-left text-[12px] text-muted-foreground">
          © {year} Done. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-start gap-x-4 gap-y-1 text-[12px] sm:justify-end">
          <Link
            href="/terms"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
