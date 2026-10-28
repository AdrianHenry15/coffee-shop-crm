import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { PasswordForm } from "@/app/auth/password-form"

export default async function ResetPasswordPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect("/forgot-password?error=recovery")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <header className="space-y-2">
          <h1 className="font-mono text-2xl font-semibold text-foreground">
            Choose a new password
          </h1>

          <p className="text-sm leading-6 text-muted">
            Enter and confirm your new password.
          </p>
        </header>

        <PasswordForm mode="reset" />
      </div>
    </main>
  )
}
