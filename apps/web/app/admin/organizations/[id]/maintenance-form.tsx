"use client"

import { useState, useTransition } from "react"
import { updateMaintenance } from "../actions"

type MaintenanceFormProps = {
  organizationId: string
  startDate: string | null
  endDate: string | null
}

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : ""
}

export function MaintenanceForm({
  organizationId,
  startDate,
  endDate,
}: MaintenanceFormProps) {
  const [start, setStart] = useState(toDateInput(startDate))
  const [end, setEnd] = useState(toDateInput(endDate))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function save() {
    setError(null)
    setSuccess(false)

    if (!start || !end) {
      setError("Select both dates.")
      return
    }

    startTransition(async () => {
      const result = await updateMaintenance(organizationId, start, end)

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  function clear() {
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await updateMaintenance(organizationId, null, null)

      if (result.error) {
        setError(result.error)
      } else {
        setStart("")
        setEnd("")
        setSuccess(true)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="block font-medium">Start date</span>

          <input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-foreground"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="block font-medium">End date (exclusive)</span>

          <input
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            disabled={pending}
            min={start || undefined}
            className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-foreground"
          />
        </label>
      </div>

      <p className="text-xs text-foreground/60">
        Partner+ is active from the start date until the beginning of the end
        date, using UTC.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
          {pending ? "Saving..." : "Save Maintenance"}
        </button>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm disabled:opacity-50">
            Clear Maintenance
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="text-sm text-green-600">
          Maintenance agreement updated.
        </p>
      )}
    </div>
  )
}
