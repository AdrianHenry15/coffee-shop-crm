import { PasswordForm } from "@/app/auth/password-form"

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <header className="space-y-2">
          <h1 className="font-mono text-2xl font-semibold text-foreground">
            Reset your password
          </h1>

          <p className="text-sm leading-6 text-muted">
            Enter your account email and we’ll send you a reset link.
          </p>
        </header>

        {error === "recovery" && (
          <p role="alert" className="text-sm text-red-600">
            Your reset link is invalid or expired. Request a new one below.
          </p>
        )}

        <PasswordForm mode="request" />
      </div>
    </main>
  )
}
