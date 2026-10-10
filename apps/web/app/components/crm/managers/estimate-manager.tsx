"use client"

import { useState, useTransition } from "react"
import {
  updateEstimateStatus,
  updateEstimateNotes,
  deleteEstimate,
} from "@/app/org/[slug]/estimates/actions"
import { ConfirmDialog } from "../ui/confirm-dialog"
import { useRouter } from "next/navigation"

export type EstimateStatus = "draft" | "sent" | "accepted" | "declined"

const statusOptions: Record<EstimateStatus, EstimateStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "declined"],
  accepted: [],
  declined: [],
}

const statusLabels: Record<EstimateStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
}

type Props = {
  slug: string
  estimate: {
    id: string
    status: EstimateStatus
    notes: string | null
  }
}

export function EstimateManager({ slug, estimate }: Props) {
  const router = useRouter()

  const [status, setStatus] = useState<EstimateStatus>(estimate.status)

  const [notes, setNotes] = useState(estimate.notes ?? "")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const availableStatuses = statusOptions[status]
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
    setError("")

    startTransition(async () => {
      try {
        await deleteEstimate(slug, estimate.id)
        router.push(`/org/${slug}/estimates`)
        router.refresh()
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to delete estimate.",
        )
      }
    })
  }

  return (
    <section className="space-y-5 rounded-lg border p-5">
      <h2 className="text-lg font-semibold">Manage Estimate</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium">Status</label>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Estimate Status</label>

          {availableStatuses.length > 0 ? (
            <select
              value={status}
              disabled={pending}
              onChange={(event) =>
                changeStatus(event.target.value as EstimateStatus)
              }
              className="w-full rounded-md border bg-transparent p-3">
              <option value={status}>{statusLabels[status]}</option>

              {availableStatuses.map((option) => (
                <option key={option} value={option}>
                  {statusLabels[option]}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500">
              {statusLabels[status]} — Final status
            </p>
          )}
        </div>
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
          onClick={() => setConfirmDelete(true)}
          className="rounded-md border border-red-500 px-4 py-2 text-sm text-red-600 disabled:opacity-50">
          Delete Estimate
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Estimate?"
        description="This will permanently delete the estimate and its services. This action cannot be undone."
        pending={pending}
        error={error}
        onCancel={() => {
          setConfirmDelete(false)
          setError("")
        }}
        onConfirm={removeEstimate}
      />
    </section>
  )
}
