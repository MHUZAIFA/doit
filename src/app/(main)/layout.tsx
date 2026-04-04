import { AppShell } from "@/components/app-shell"
import { OfflineToastListener } from "@/components/offline-toast-listener"

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <OfflineToastListener />
      <AppShell>{children}</AppShell>
    </>
  )
}
