"use client"

import { useState, useTransition } from "react"
import { updateOrganizationTimezone } from "@/app/org/[slug]/settings/actions"

type Props = {
  slug: string
  timezone: string
  canEdit: boolean
}

const timezones = [
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
]

export function OrganizationSettings({ slug, timezone, canEdit }: Props) {
  const [selected, setSelected] = useState(timezone)
  const [saved, setSaved] = useState(timezone)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function handleSave() {
    setError("")

    startTransition(async () => {
      try {
        await updateOrganizationTimezone(slug, selected)
        setSaved(selected)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save timezone")
      }
    })
  }

  return (
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Timezone
        </h2>

        <p className="mt-1 text-sm text-muted">
          Jobs and schedules use this timezone for all organization members.
        </p>
      </div>

      <div className="max-w-md space-y-2">
        <label
          htmlFor="organization-timezone"
          className="block text-sm font-medium text-foreground">
          Organization timezone
        </label>

        <select
          id="organization-timezone"
          value={selected}
          disabled={!canEdit || pending}
          onChange={(event) => setSelected(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60">
          {timezones.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <p className="text-xs text-muted">
          This setting controls how scheduled job dates and times are displayed
          across your workspace.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          {!canEdit ? (
            <p className="text-xs text-muted">
              Only the organization owner can change the timezone.
            </p>
          ) : selected !== saved ? (
            <p className="text-xs text-muted">You have unsaved changes.</p>
          ) : (
            <p className="text-xs text-muted">
              Current timezone:{" "}
              <span className="font-mono text-foreground">{saved}</span>
            </p>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || selected === saved}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? "Saving..." : "Save changes"}
          </button>
        )}
      </div>
    </section>
  )
}
