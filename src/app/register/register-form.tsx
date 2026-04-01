"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AuthPageShell } from "@/components/auth-page-shell"
import { AuthFormAlert } from "@/components/auth/auth-form-alert"
import { PasswordInput } from "@/components/auth/password-input"
import { PasswordRequirements } from "@/components/auth/password-requirements"
import { PasswordStrengthMeter } from "@/components/auth/password-strength"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

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
    setConfirmError(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (trimmedName.length < 2) {
      setFormError("Please enter your full name (at least 2 characters).")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.")
      return
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match.")
      return
    }

    if (!acceptedTerms) {
      setFormError("Please accept the Terms of Service and Privacy Policy to continue.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "We couldn’t create your account. Try again."
        setFormError(msg)
        toast.error(msg)
        return
      }
      toast.success("Account created")
      router.push("/dashboard")
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
      title="Create your account"
      description="Set up DoIt in a minute. You can change preferences anytime after sign-up."
      alternateAuth={
        <Link
          href="/login"
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" aria-busy={loading} noValidate>
          <AuthFormAlert message={formError} />

          <div className="space-y-2">
            <Label htmlFor="reg-name" className="text-[12px] font-medium text-muted-foreground">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reg-name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (formError) setFormError(null)
              }}
              disabled={loading}
              required
              minLength={2}
              className="h-11 text-[15px] dark:border-white/10"
              placeholder="Alex Johnson"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email" className="text-[12px] font-medium text-muted-foreground">
              Work email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reg-email"
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
              aria-describedby={emailError ? "reg-email-error" : undefined}
              disabled={loading}
              className="h-11 text-[15px] dark:border-white/10"
              placeholder="you@company.com"
            />
            {emailError ? (
              <p id="reg-email-error" className="text-[12px] text-destructive" role="alert">
                {emailError}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <Label htmlFor="reg-password" className="text-[12px] font-medium text-muted-foreground">
              Password <span className="text-destructive">*</span>
            </Label>
            <PasswordInput
              id="reg-password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (formError) setFormError(null)
                if (confirmError && confirmPassword === e.target.value) setConfirmError(null)
              }}
              disabled={loading}
              required
              minLength={8}
              aria-describedby="password-hint"
            />
            <div id="password-hint" className="space-y-3">
              <PasswordStrengthMeter password={password} />
              <PasswordRequirements password={password} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-confirm" className="text-[12px] font-medium text-muted-foreground">
              Confirm password <span className="text-destructive">*</span>
            </Label>
            <PasswordInput
              id="reg-confirm"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (confirmError) setConfirmError(null)
                if (formError) setFormError(null)
              }}
              disabled={loading}
              required
              aria-invalid={Boolean(confirmError)}
              aria-describedby={confirmError ? "reg-confirm-error" : undefined}
            />
            {confirmError ? (
              <p id="reg-confirm-error" className="text-[12px] text-destructive" role="alert">
                {confirmError}
              </p>
            ) : confirmPassword.length > 0 && password === confirmPassword ? (
              <p className="text-[12px] text-emerald-600 dark:text-emerald-400">Passwords match.</p>
            ) : null}
          </div>

          <div className="flex gap-3 py-2">
            <Checkbox
              id="terms"
              checked={acceptedTerms}
              onCheckedChange={(v) => {
                setAcceptedTerms(v === true)
                if (formError?.includes("accept")) setFormError(null)
              }}
              disabled={loading}
              className="mt-0.5"
            />
            <Label
              htmlFor="terms"
              className="cursor-pointer text-left text-[13px] font-normal leading-snug text-muted-foreground"
            >
              I agree to the{" "}
              <Link href="/terms" className="font-medium text-foreground underline-offset-4 hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-foreground underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              . <span className="text-destructive">*</span>
            </Label>
          </div>

          <Button type="submit" className="h-11 w-full rounded-md text-[14px] font-medium" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
      </form>

      <Separator className="my-8 dark:bg-white/10" />

      <p className="text-center text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  )
}
