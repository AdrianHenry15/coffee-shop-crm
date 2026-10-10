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
    <section className="max-w-xl space-y-5 rounded-lg border p-6">
      <div>
        <h2 className="font-semibold">Timezone</h2>
        <p className="mt-1 text-sm text-gray-500">
          Jobs and schedules use this timezone for all organization members.
        </p>
      </div>

      <select
        value={selected}
        disabled={!canEdit || pending}
        onChange={(event) => setSelected(event.target.value)}
        className="w-full rounded-md border bg-transparent p-3">
        {timezones.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={!canEdit || pending || selected === saved}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Saving..." : "Save Changes"}
      </button>

      {selected === saved && !error && (
        <p className="text-xs text-gray-500">Current timezone: {saved}</p>
      )}
    </section>
  )
}
