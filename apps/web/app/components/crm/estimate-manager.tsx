"use client"

import { useState, useTransition } from "react"
import {
  updateEstimateStatus,
  updateEstimateNotes,
  deleteEstimate,
} from "@/app/org/[slug]/estimates/actions"

export type EstimateStatus = "draft" | "sent" | "accepted" | "declined"

type Props = {
  slug: string
  estimate: {
    id: string
    status: EstimateStatus
    notes: string | null
  }
}

export function EstimateManager({ slug, estimate }: Props) {
  const [status, setStatus] = useState<EstimateStatus>(estimate.status)

  const [notes, setNotes] = useState(estimate.notes ?? "")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function changeStatus(value: EstimateStatus) {
    setError("")

    startTransition(async () => {
      try {
        await updateEstimateStatus(slug, estimate.id, value)
        setStatus(value)
      } catch {
        setError("Unable to update status.")
      }
    })
  }

  function saveNotes() {
    setError("")

    startTransition(async () => {
      try {
        await updateEstimateNotes(slug, estimate.id, notes)
      } catch {
        setError("Unable to save notes.")
      }
    })
  }

  function removeEstimate() {
    if (!window.confirm("Delete this estimate permanently?")) {
      return
    }

    setError("")

    startTransition(async () => {
      try {
        await deleteEstimate(slug, estimate.id)
      } catch {
        setError("Unable to delete estimate.")
      }
    })
  }

  return (
    <section className="space-y-5 rounded-lg border p-5">
      <h2 className="text-lg font-semibold">Manage Estimate</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium">Status</label>

        <select
          value={status}
          disabled={pending}
          onChange={(event) =>
            changeStatus(event.target.value as EstimateStatus)
          }
          className="w-full rounded-md border p-3">
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>

        <textarea
          value={notes}
          disabled={pending}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="w-full rounded-md border p-3"
        />

        <button
          type="button"
          disabled={pending}
          onClick={saveNotes}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
          Save Notes
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="border-t pt-5">
        <button
          type="button"
          disabled={pending}
          onClick={removeEstimate}
          className="rounded-md border border-red-500 px-4 py-2 text-sm text-red-600 disabled:opacity-50">
          Delete Estimate
        </button>
      </div>
    </section>
  )
}
