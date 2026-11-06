import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { logout } from "@/app/auth/actions"
import { createClient } from "@/app/lib/supabase/server"
import { acceptLegalDocuments } from "./actions"

export const metadata: Metadata = {
  title: "Review our terms | CoffeeShopCRM",
  robots: {
    index: false,
    follow: false,
  },
}

const errorMessages: Record<string, string> = {
  required:
    "Agree to the Terms and acknowledge the Privacy Notice to continue.",
  version: "The document versions changed. Review the current documents below.",
  save: "Unable to save your acceptance. Please try again.",
}

export default async function LegalAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const { data: accepted, error } = await supabase.rpc(
    "has_current_legal_acceptance",
  )

  if (error) {
    throw new Error("Unable to verify legal acceptance.")
  }

  if (accepted === true) {
    redirect("/dashboard")
  }

  const { error: errorCode } = await searchParams
  const errorMessage = errorCode ? errorMessages[errorCode] : undefined

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-xl space-y-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <header className="space-y-3">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            CoffeeShopCRM
          </p>

          <h1 className="font-mono text-3xl font-semibold text-foreground">
            Before you continue
          </h1>

          <p className="text-sm leading-relaxed text-muted">
            Please review our Terms of Service and Privacy Notice before using
            your workspace. CoffeeShopCRM is operated by Third Generation
            Studios.
          </p>
        </header>

        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline">
            Read Terms of Service ↗
          </Link>

          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline">
            Read Privacy Notice ↗
          </Link>
        </div>

        <p className="text-xs text-muted">
          Document versions: November 3, 2026
        </p>

        <form action={acceptLegalDocuments} className="space-y-5">
          <input type="hidden" name="termsVersion" value="2026-11-03" />

          <input type="hidden" name="privacyVersion" value="2026-11-03" />

          <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
            <input
              type="checkbox"
              name="acceptTerms"
              value="yes"
              required
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />

            <span>
              I agree to the Terms of Service and acknowledge the Privacy
              Notice.
            </span>
          </label>

          {errorMessage && (
            <p role="alert" className="text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Agree and continue
          </button>
        </form>

        <div className="flex items-center justify-between border-t border-border pt-5 text-sm">
          <Link href="/account" className="text-primary hover:underline">
            Your account
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className="text-muted hover:text-primary hover:underline">
              Log out
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
