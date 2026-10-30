"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { requestEmailChange } from "./email-actions"
import type { AccountActionResult } from "./actions"

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<AccountActionResult | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pending) return

    const form = event.currentTarget
    const formData = new FormData(form)

    setResult(null)

    startTransition(async () => {
      try {
        const response = await requestEmailChange(formData)
        setResult(response)

        if (response.success) {
          form.reset()
          router.refresh()
        }
      } catch {
        setResult({
          success: false,
          message: "Unable to request the email change. Please try again.",
        })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm leading-6 text-muted">
        Your current login email is{" "}
        <span className="wrap-break-word font-medium text-foreground">
          {currentEmail}
        </span>
        . You’ll need access to both inboxes to change it.
      </p>

      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">Change login email</legend>

        <div className="space-y-2">
          <label
            htmlFor="newEmail"
            className="block text-sm font-medium text-foreground">
            New email address
          </label>

          <input
            id="newEmail"
            name="newEmail"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmEmail"
            className="block text-sm font-medium text-foreground">
            Confirm new email address
          </label>

          <input
            id="confirmEmail"
            name="confirmEmail"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="currentPassword"
            className="block text-sm font-medium text-foreground">
            Current password
          </label>

          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            className={inputClass}
          />
        </div>
      </fieldset>

      {result && (
        <p
          role={result.success ? "status" : "alert"}
          className={`text-sm leading-6 ${
            result.success ? "text-primary" : "text-red-600"
          }`}>
          {result.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Sending confirmations..." : "Request email change"}
      </button>
    </form>
  )
}
