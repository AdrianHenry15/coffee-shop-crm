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
    <section className="space-y-5 rounded-lg border p-5">
      <h2 className="text-lg font-semibold">
        Customer Activity ({activities.length})
      </h2>

      <form ref={formRef} action={handleCreate} className="space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="customerId" value={customerId} />

        <select name="type" className="w-full rounded-md border p-3">
          <option value="note">Note</option>
          <option value="call">Phone Call</option>
          <option value="email">Email</option>
        </select>

        <textarea
          name="content"
          required
          maxLength={5000}
          rows={3}
          placeholder="Record a customer interaction..."
          className="w-full rounded-md border p-3"
        />

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50">
          {pending ? "Saving..." : "Add Activity"}
        </button>
      </form>

      <div className="divide-y">
        {activities.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">
            No customer activity recorded yet.
          </p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="space-y-2 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold capitalize">
                    {activity.type === "call" ? "Phone Call" : activity.type}
                  </p>

                  <p className="text-xs text-gray-500">
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
                    className="text-sm text-red-600 disabled:opacity-50">
                    Delete
                  </button>
                )}
              </div>

              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {activity.content}
              </p>
            </div>
          ))
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
