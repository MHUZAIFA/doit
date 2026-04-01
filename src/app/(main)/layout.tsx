import { AppShell } from "@/components/app-shell"
import { OfflineBanner } from "@/components/offline-banner"

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <OfflineBanner />
      <AppShell>{children}</AppShell>
    </>
  )
}
