"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { AuthPageShell } from "@/components/auth-page-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/dashboard"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  function validateEmail(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      setEmailError(null)
      return
    }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    setEmailError(ok ? null : "Enter a valid email address.")
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)

    const trimmedEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.")
      return
    }
    if (!password) {
      toast.error("Enter your password.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Sign in failed."
        toast.error(msg)
        return
      }
      const user = data.user as { name?: string } | undefined
      const displayName = typeof user?.name === "string" ? user.name.trim() : ""
      toast.success(displayName ? `Welcome back, ${displayName}!` : "Welcome back")
      router.push(next)
      router.refresh()
    } catch {
      toast.error("Something went wrong. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  const trimmedEmail = email.trim()
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
  const canSubmit = emailValid && password.length > 0

  return (
    <AuthPageShell
      title="Sign in"
      description="Enter your work email and password to continue to your workspace."
      alternateAuth={
        <Link
          href="/register"
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Create account
        </Link>
      }
    >
      <form
        onSubmit={onSubmit}
        className="space-y-5"
        aria-busy={loading}
        noValidate
      >
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[12px] font-medium text-muted-foreground">
              Work email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) validateEmail(e.target.value)
              }}
              onBlur={() => validateEmail(email)}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "email-error" : undefined}
              disabled={loading}
              className="dark:border-white/10"
              placeholder="you@company.com"
            />
            {emailError ? (
              <p id="email-error" className="text-[12px] text-destructive" role="alert">
                {emailError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground">
                Password <span className="text-destructive">*</span>
              </Label>
              <Link
                href="/forgot-password"
                className="text-[12px] font-medium text-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              placeholder="Enter your password"
            />
          </div>

          <Button
            type="submit"
            className="h-11 w-full text-[14px] font-medium"
            disabled={loading || !canSubmit}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
            You’ll stay signed in for 7 days on this browser unless you sign out.
          </p>
      </form>

      <Separator className="my-8 dark:bg-white/10" />

      <p className="text-center text-[13px] text-muted-foreground">
        Don’t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </AuthPageShell>
  )
}
