"use client"

import { useRef, useState, useTransition } from "react"
import {
  createCustomerActivity,
  deleteCustomerActivity,
} from "@/app/org/[slug]/customers/[id]/actions"
import { ConfirmDialog } from "./ui/confirm-dialog"

type Activity = {
  id: string
  type: string
  content: string
  created_by: string
  created_at: string
}

type Props = {
  slug: string
  customerId: string
  userId: string
  activities: Activity[]
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
export function CustomerActivity({
  slug,
  customerId,
  userId,
  activities,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState("")

  function handleCreate(formData: FormData) {
    setError("")

    startTransition(async () => {
      try {
        await createCustomerActivity(formData)
        formRef.current?.reset()
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to create activity.",
        )
      }
    })
  }

  function handleDelete() {
    if (!selectedActivity) return

    setDeleteError("")

    const formData = new FormData()
    formData.set("slug", slug)
    formData.set("customerId", customerId)
    formData.set("activityId", selectedActivity)

    startTransition(async () => {
      try {
        await deleteCustomerActivity(formData)
        setSelectedActivity(null)
      } catch (error) {
        setDeleteError(
          error instanceof Error ? error.message : "Unable to delete activity.",
        )
      }
    })
  }

  return (
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Customer activity
        </h2>

        <p className="mt-1 text-sm text-muted">
          Record calls, emails, and notes.
        </p>
      </div>

      <form
        ref={formRef}
        action={handleCreate}
        className="space-y-4 rounded-lg border border-border bg-surface-secondary p-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="customerId" value={customerId} />

        <div className="space-y-2">
          <label
            htmlFor="activity-type"
            className="block text-sm font-medium text-foreground">
            Activity type
          </label>

          <select
            id="activity-type"
            name="type"
            disabled={pending}
            className={inputClass}>
            <option value="note">Note</option>
            <option value="call">Phone call</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="activity-content"
            className="block text-sm font-medium text-foreground">
            Details
          </label>

          <textarea
            id="activity-content"
            name="content"
            required
            maxLength={5000}
            rows={3}
            disabled={pending}
            placeholder="Record a customer interaction..."
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
          {pending ? "Saving..." : "Add activity"}
        </button>
      </form>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-mono text-sm font-semibold text-foreground">
            Activity history
          </h3>

          <span className="font-mono text-xs text-muted">
            {activities.length} total
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted">
              No customer activity recorded yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity) => (
              <div key={activity.id} className="space-y-3 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-mono text-sm font-semibold capitalize text-foreground">
                      {activity.type === "call" ? "Phone call" : activity.type}
                    </p>

                    <p className="text-xs text-muted">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>

                  {activity.created_by === userId && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setDeleteError("")
                        setSelectedActivity(activity.id)
                      }}
                      className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50">
                      Delete
                    </button>
                  )}
                </div>

                <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-foreground">
                  {activity.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={selectedActivity !== null}
        title="Delete activity?"
        description="This activity will be permanently deleted. This action cannot be undone."
        pending={pending}
        error={deleteError}
        onCancel={() => {
          setSelectedActivity(null)
          setDeleteError("")
        }}
        onConfirm={handleDelete}
      />
    </section>
  )
}
