"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { AuthPageShell } from "@/components/auth-page-shell"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email address.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Request failed."
        toast.error(msg)
        return
      }
      setDone(true)
      toast.success("Request received")
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <AuthPageShell
      title="Reset password"
      description={
        done
          ? "Check the message below. Add email delivery in your environment to complete this flow."
          : "We’ll email you a reset link when outbound email is configured for this app."
      }
      alternateAuth={
        <Link
          href="/login"
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to sign in
        </Link>
      }
    >
      {done ? (
        <div className="space-y-6">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>,
            password reset instructions will be sent once your team enables transactional email.
          </p>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "flex h-11 w-full items-center justify-center text-[14px] font-medium"
            )}
          >
            Return to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="fp-email" className="text-[12px] font-medium text-muted-foreground">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="dark:border-white/10"
              placeholder="you@company.com"
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full text-[14px] font-medium"
            disabled={loading || !emailValid}
          >
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="mt-8 text-center text-[13px] text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </AuthPageShell>
  )
}
