import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { AuthForm } from "@/app/components/auth/auth-form"

export default async function SignupPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <header className="space-y-2">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            CoffeeShopCRM
          </p>

          <h1 className="font-mono text-3xl font-semibold text-foreground">
            Create your account
          </h1>

          <p className="text-sm text-muted">
            Start with your personal details, then set up your business
            workspace.
          </p>
        </header>

        <AuthForm mode="signup" />

        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
