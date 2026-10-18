import Link from "next/link"
import { redirect } from "next/navigation"
import { logout } from "@/app/auth/actions"
import { createClient } from "@/app/lib/supabase/server"
import { OnboardingForm } from "./onboarding-form"

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    redirect("/login")
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .limit(1)

  if (membershipError) {
    throw new Error("Unable to load organization membership.")
  }

  if (memberships?.length) {
    redirect("/dashboard")
  }

  const timezones = [
    ...new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]),
  ].sort()

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-2">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            CoffeeShopCRM / Business setup
          </p>

          <h1 className="font-mono text-3xl font-semibold text-foreground">
            Create your workspace
          </h1>

          <p className="text-sm text-muted">
            Tell us about your business. These details are separate from your
            personal account and can be updated in workspace settings.
          </p>
        </header>

        <div className="rounded-xl border border-border bg-surface p-6">
          {authData.user.email_confirmed_at ? (
            <OnboardingForm timezones={timezones} />
          ) : (
            <p role="status" className="text-sm text-muted">
              Confirm your account email before creating a workspace. Check your
              inbox for the confirmation link.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <Link
            href="/account"
            className="text-sm font-medium text-primary hover:underline">
            Your account
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-muted hover:text-primary hover:underline">
              Log out
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
