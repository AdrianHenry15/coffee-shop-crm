import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { AuthForm } from "@/app/components/auth/auth-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}) {
  const { error, message } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <header className="space-y-2">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            CoffeeShopCRM
          </p>

          <h1 className="font-mono text-3xl font-semibold text-foreground">
            Welcome back
          </h1>

          <p className="text-sm text-muted">Log in to your account.</p>
        </header>

        {message === "check-email" && (
          <p
            role="status"
            className="rounded-lg bg-primary/10 p-4 text-sm text-primary">
            Check your email to confirm your account. If you already have an
            account, you can sign in below.
          </p>
        )}

        {error === "confirmation" && (
          <p role="alert" className="text-sm text-red-600">
            That confirmation link is invalid or expired.
          </p>
        )}

        <AuthForm mode="login" />

        <p className="text-center text-sm text-muted">
          New to CoffeeShopCRM?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
