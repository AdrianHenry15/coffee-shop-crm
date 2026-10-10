"use client"

import { useState, useTransition } from "react"
import {
  updateJob,
  updateJobStatus,
  deleteJob,
} from "@/app/org/[slug]/jobs/actions"
import { organizationTimeToUTC, utcToOrganizationTime } from "@/app/lib/dates"
import { ConfirmDialog } from "../ui/confirm-dialog"
import { useRouter } from "next/navigation"

type JobStatus = "scheduled" | "in_progress" | "completed" | "canceled"

type Job = {
  id: string
  title: string
  description: string | null
  status: JobStatus
  scheduled_start: string | null
  scheduled_end: string | null
}

type Props = {
  slug: string
  timezone: string
  job: Job
}

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
export function JobManager({ slug, timezone, job }: Props) {
  const router = useRouter()

  const [title, setTitle] = useState(job.title)
  const [description, setDescription] = useState(job.description ?? "")
  const [status, setStatus] = useState<JobStatus>(job.status)
  const [start, setStart] = useState(
    utcToOrganizationTime(job.scheduled_start, timezone),
  )
  const [end, setEnd] = useState(
    utcToOrganizationTime(job.scheduled_end, timezone),
  )

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function saveJob() {
    setError("")
    setSaved(false)

    startTransition(async () => {
      try {
        await updateJob(slug, job.id, {
          title,
          description,
          scheduledStart: organizationTimeToUTC(start, timezone),
          scheduledEnd: organizationTimeToUTC(end, timezone),
        })

        setSaved(true)
        router.refresh()
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to update job.",
        )
      }
    })
  }

  function changeStatus(value: JobStatus) {
    setError("")
    setSaved(false)

    startTransition(async () => {
      try {
        await updateJobStatus(slug, job.id, value)
        setStatus(value)
        router.refresh()
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to update status.",
        )
      }
    })
  }

  function removeJob() {
    setError("")

    startTransition(async () => {
      try {
        await deleteJob(slug, job.id)

        router.push(`/org/${slug}/jobs`)
        router.refresh()
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to delete job.",
        )
      }
    })
  }

  return (
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Manage job
        </h2>

        <p className="mt-1 text-sm text-muted">
          Update job details, status, and scheduling.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="job-status"
          className="block text-sm font-medium text-foreground">
          Job status
        </label>

        <select
          id="job-status"
          value={status}
          disabled={pending}
          onChange={(event) => changeStatus(event.target.value as JobStatus)}
          className={inputClass}>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="space-y-5 border-t border-border pt-6">
        <div>
          <h3 className="font-mono text-base font-semibold text-foreground">
            Job details
          </h3>

          <p className="mt-1 text-sm text-muted">
            Information about the work being performed.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="job-edit-title"
            className="block text-sm font-medium text-foreground">
            Title
          </label>

          <input
            id="job-edit-title"
            value={title}
            disabled={pending}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="job-edit-description"
            className="block text-sm font-medium text-foreground">
            Description
          </label>

          <textarea
            id="job-edit-description"
            value={description}
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="Describe the work to be completed..."
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-5 border-t border-border pt-6">
        <div>
          <h3 className="font-mono text-base font-semibold text-foreground">
            Schedule
          </h3>

          <p className="mt-1 text-sm text-muted">
            Adjust the planned start and end times.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="job-edit-start"
              className="block text-sm font-medium text-foreground">
              Scheduled start
            </label>

            <input
              id="job-edit-start"
              type="datetime-local"
              value={start}
              disabled={pending}
              onChange={(event) => setStart(event.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="job-edit-end"
              className="block text-sm font-medium text-foreground">
              Scheduled end
            </label>

            <input
              id="job-edit-end"
              type="datetime-local"
              value={end}
              disabled={pending}
              onChange={(event) => setEnd(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <p className="text-xs text-muted">
          Times are displayed in your organization&apos;s timezone.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      {saved && (
        <p role="status" className="text-sm text-primary">
          Job updated successfully.
        </p>
      )}

      <div className="flex justify-end border-t border-border pt-6">
        <button
          type="button"
          disabled={pending}
          onClick={saveJob}
          className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="font-mono text-sm font-semibold text-foreground">
          Danger zone
        </h3>

        <p className="text-sm text-muted">
          Permanently delete this job. Its linked customer and estimate will
          remain unchanged.
        </p>

        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmDelete(true)}
          className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50">
          Delete job
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete job?"
        description="This will permanently delete the job. Any linked customer or estimate will remain unchanged."
        pending={pending}
        error={confirmDelete ? error : ""}
        onCancel={() => {
          setConfirmDelete(false)
          setError("")
        }}
        onConfirm={removeJob}
      />
    </section>
  )
}
