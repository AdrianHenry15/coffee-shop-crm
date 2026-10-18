"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  grantAdministrator,
  revokeAdministrator,
  type AdministratorActionResult,
} from "./actions"

type Administrator = {
  user_id: string
  email: string | null
  role: string
  created_at: string
}

type Props = {
  administrators: Administrator[]
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

const primaryButton =
  "rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"

export function AdministratorManager({ administrators }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [feedback, setFeedback] = useState<AdministratorActionResult | null>(
    null,
  )
  const [pending, startTransition] = useTransition()

  function grantAccess(formData: FormData) {
    setFeedback(null)

    startTransition(async () => {
      try {
        const result = await grantAdministrator(formData)
        setFeedback(result)

        if (result.success) {
          setEmail("")
          router.refresh()
        }
      } catch {
        setFeedback({
          success: false,
          message: "Unable to grant administrator access. Try again.",
        })
      }
    })
  }

  function removeAccess(administrator: Administrator) {
    if (pending || administrator.role === "owner") return

    const confirmed = window.confirm(
      `Remove platform administrator access for ${
        administrator.email ?? administrator.user_id
      }?\n\nTheir account and workspace memberships will remain.`,
    )

    if (!confirmed) return

    setFeedback(null)

    const formData = new FormData()
    formData.set("userId", administrator.user_id)

    startTransition(async () => {
      try {
        const result = await revokeAdministrator(formData)
        setFeedback(result)

        if (result.success) {
          router.refresh()
        }
      } catch {
        setFeedback({
          success: false,
          message: "Unable to remove administrator access. Try again.",
        })
      }
    })
  }

  return (
    <div className="space-y-6" aria-busy={pending}>
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Add administrator
        </h2>

        <p className="mt-2 text-sm text-muted">
          Enter the email of an existing registered account. Platform
          administrators can manage organizations and Partner benefits. Only
          platform owners can manage administrator access.
        </p>

        <form action={grantAccess} className="mt-5 space-y-3">
          <label
            htmlFor="administrator-email"
            className="block text-sm font-medium text-foreground">
            Account email
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="administrator-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
              disabled={pending}
              placeholder="name@example.com"
              className={inputClass}
            />

            <button
              type="submit"
              disabled={pending || !email.trim()}
              className={`${primaryButton} shrink-0`}>
              {pending ? "Processing..." : "Grant admin access"}
            </button>
          </div>
        </form>
      </section>

      {feedback && (
        <p
          role={feedback.success ? "status" : "alert"}
          className={`rounded-lg border border-border bg-surface p-4 text-sm ${
            feedback.success ? "text-primary" : "text-red-600"
          }`}>
          {feedback.message}
        </p>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Platform administrators
          </h2>

          <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-foreground">
            {administrators.length} total
          </span>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {administrators.map((administrator) => (
            <div
              key={administrator.user_id}
              className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 space-y-2">
                <p className="wrap-break-word font-medium text-foreground">
                  {administrator.email ?? "Email unavailable"}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium capitalize text-primary">
                    {administrator.role}
                  </span>

                  <p className="text-xs text-muted">
                    Added{" "}
                    {new Date(administrator.created_at).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      },
                    )}
                  </p>
                </div>
              </div>

              {administrator.role === "owner" ? (
                <span className="text-xs font-medium text-muted">
                  Protected owner account
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeAccess(administrator)}
                  className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                  Remove access
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
