import { Suspense } from "react"

import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-col items-center justify-center bg-background px-6 py-16">
          <div className="h-4 w-32 animate-pulse rounded bg-muted dark:bg-white/5" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
