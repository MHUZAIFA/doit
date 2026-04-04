import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { UserThemeBootstrap } from "@/components/user-theme-bootstrap"
import { SiteFooter } from "@/components/site-footer"
import { Toaster } from "@/components/ui/sonner"
import { ServiceWorkerRegister } from "@/components/service-worker-register"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Done.",
  description:
    "Plan tasks with AI, maps, and weather-aware scheduling. Light and dark mode.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="doit-theme"
          disableTransitionOnChange
        >
          <UserThemeBootstrap />
          {children}
          <SiteFooter />
          <Toaster
            position="bottom-center"
            richColors
            closeButton
            offset={{ bottom: "5rem" }}
            mobileOffset={{ bottom: "6rem" }}
          />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
