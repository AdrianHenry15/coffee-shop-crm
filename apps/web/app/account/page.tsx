import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { AccountForm } from "./account-form"

export default async function AccountPage() {
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    redirect("/login")
  }

  const user = authData.user

  const [profileResult, accountResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("account_details")
      .select("phone")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  if (profileResult.error || accountResult.error) {
    throw new Error("Unable to load your account details.")
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/dashboard"
          className="inline-flex text-sm font-medium text-muted transition-colors hover:text-primary hover:underline">
          ← Back to dashboard
        </Link>

        <header className="space-y-2">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Personal settings
          </p>

          <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
            Your account
          </h1>

          <p className="text-sm text-muted">
            Manage your personal information. Business details are managed
            separately in each workspace’s settings.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-6 space-y-2">
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Personal information
            </h2>

            <p className="text-sm text-muted">
              Your name identifies you to other members of your workspaces.
            </p>
          </div>

          <AccountForm
            firstName={profileResult.data?.first_name ?? ""}
            lastName={profileResult.data?.last_name ?? ""}
            phone={accountResult.data?.phone ?? ""}
          />
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Login email
          </h2>

          <p className="wrap-break-word text-sm font-medium text-foreground">
            {user.email ?? "No email associated with this account"}
          </p>

          <span className="inline-flex rounded-full bg-surface-secondary px-3 py-1 font-mono text-xs text-foreground">
            {user.email_confirmed_at ? "Email verified" : "Email not verified"}
          </span>

          <p className="text-sm text-muted">
            This is the email you use to sign in. Each workspace has its own
            business contact email.
          </p>
        </section>
      </div>
    </main>
  )
}
