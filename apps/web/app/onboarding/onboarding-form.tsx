"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { createOrganization } from "./actions"

type Props = {
  timezones: string[]
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

export function OnboardingForm({ timezones }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pending) return

    setError(null)
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      try {
        const result = await createOrganization(formData)

        if (result.error) {
          setError(result.error)
        } else if (result.redirectTo) {
          router.replace(result.redirectTo)
          router.refresh()
        }
      } catch {
        setError("Unable to create your workspace. Please try again.")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">Business information</legend>

        <div className="space-y-2">
          <label
            htmlFor="businessName"
            className="block text-sm font-medium text-foreground">
            Business name
          </label>

          <input
            id="businessName"
            name="name"
            autoComplete="organization"
            required
            maxLength={100}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="businessEmail"
            className="block text-sm font-medium text-foreground">
            Business email
          </label>

          <input
            id="businessEmail"
            name="email"
            type="email"
            autoComplete="section-business email"
            required
            maxLength={254}
            aria-describedby="business-email-description"
            className={inputClass}
          />

          <p id="business-email-description" className="text-xs text-muted">
            Your business contact email. It can match your login email if that’s
            the address you use for business.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="businessPhone"
              className="block text-sm font-medium text-foreground">
              Business phone{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>

            <input
              id="businessPhone"
              name="phone"
              type="tel"
              autoComplete="section-business tel"
              maxLength={50}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="businessWebsite"
              className="block text-sm font-medium text-foreground">
              Website <span className="font-normal text-muted">(optional)</span>
            </label>

            <input
              id="businessWebsite"
              name="website"
              type="text"
              inputMode="url"
              autoComplete="section-business url"
              placeholder="example.com"
              maxLength={2048}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="businessAddress"
            className="block text-sm font-medium text-foreground">
            Business address{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>

          <textarea
            id="businessAddress"
            name="address"
            autoComplete="section-business street-address"
            rows={3}
            maxLength={1000}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="businessTimezone"
            className="block text-sm font-medium text-foreground">
            Business timezone
          </label>

          <select
            id="businessTimezone"
            name="timezone"
            defaultValue="America/New_York"
            required
            className={inputClass}>
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <p className="text-xs text-muted">
            Used to display scheduled jobs and appointments.
          </p>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Creating workspace..." : "Create workspace"}
      </button>
    </form>
  )
}
