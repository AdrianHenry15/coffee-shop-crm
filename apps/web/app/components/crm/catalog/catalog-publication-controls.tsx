"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

type Props = {
  status: "draft" | "published"
  editUrl: string
  onChangeStatus: () => Promise<{ error?: string }>
}

export function CatalogPublicationControls({
  status,
  editUrl,
  onChangeStatus,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleStatusChange() {
    if (pending) return

    setError(null)

    startTransition(async () => {
      try {
        const result = await onChangeStatus()

        if (result.error) {
          setError(result.error)
        }

        router.refresh()
      } catch {
        setError("Unable to update publication status. Please try again.")
      }
    })
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <div className="space-y-2">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Publication
        </h2>

        <p className="text-sm text-muted">
          {status === "draft"
            ? "Save your changes before publishing. All required custom fields must be completed."
            : "Move this item back to draft before editing its details."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" && (
          <Link
            href={editUrl}
            className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-secondary">
            Edit draft
          </Link>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={handleStatusChange}
          className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {pending
            ? "Updating..."
            : status === "draft"
              ? "Publish item"
              : "Move to draft"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  )
}
