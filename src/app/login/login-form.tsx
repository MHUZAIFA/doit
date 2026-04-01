"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { AuthPageShell } from "@/components/auth-page-shell"
import { AuthFormAlert } from "@/components/auth/auth-form-alert"
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
  const [formError, setFormError] = useState<string | null>(null)
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
    setFormError(null)
    setEmailError(null)

    const trimmedEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.")
      return
    }
    if (!password) {
      setFormError("Enter your password.")
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
        setFormError(msg)
        toast.error(msg)
        return
      }
      toast.success("Welcome back")
      router.push(next)
      router.refresh()
    } catch {
      const msg = "Something went wrong. Check your connection and try again."
      setFormError(msg)
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

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
          <AuthFormAlert message={formError} />

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
                if (formError) setFormError(null)
              }}
              onBlur={() => validateEmail(email)}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "email-error" : undefined}
              disabled={loading}
              className="h-11 text-[15px] dark:border-white/10"
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
              onChange={(e) => {
                setPassword(e.target.value)
                if (formError) setFormError(null)
              }}
              disabled={loading}
              required
            />
          </div>

          <Button
            type="submit"
            className="h-11 w-full rounded-md text-[14px] font-medium"
            disabled={loading}
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
