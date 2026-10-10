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
const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

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
        router.refresh()
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
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Manage estimate
        </h2>

        <p className="mt-1 text-sm text-muted">
          Update the estimate status, notes, and settings.
        </p>
      </div>

      <div className="space-y-3">
        <label
          htmlFor="estimate-status"
          className="block text-sm font-medium text-foreground">
          Estimate status
        </label>

        {availableStatuses.length > 0 ? (
          <>
            <select
              id="estimate-status"
              value={status}
              disabled={pending}
              onChange={(event) =>
                changeStatus(event.target.value as EstimateStatus)
              }
              className={inputClass}>
              <option value={status}>{statusLabels[status]}</option>

              {availableStatuses.map((option) => (
                <option key={option} value={option}>
                  {statusLabels[option]}
                </option>
              ))}
            </select>

            <p className="text-xs text-muted">
              Changing the status updates the estimate workflow.
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-surface-secondary px-4 py-3">
            <p className="font-mono text-sm font-medium text-foreground">
              {statusLabels[status]}
            </p>

            <p className="mt-1 text-xs text-muted">
              This estimate has reached a final status.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-5">
        <label
          htmlFor="estimate-notes"
          className="block text-sm font-medium text-foreground">
          Notes
        </label>

        <textarea
          id="estimate-notes"
          value={notes}
          disabled={pending}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="Additional estimate details..."
          className={inputClass}
        />

        <button
          type="button"
          disabled={pending}
          onClick={saveNotes}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-50">
          {pending ? "Saving..." : "Save notes"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="space-y-3 border-t border-border pt-5">
        <h3 className="font-mono text-sm font-semibold text-foreground">
          Danger zone
        </h3>

        <p className="text-sm text-muted">
          Permanently remove this estimate and its associated services.
        </p>

        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmDelete(true)}
          className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50">
          Delete estimate
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete estimate?"
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
