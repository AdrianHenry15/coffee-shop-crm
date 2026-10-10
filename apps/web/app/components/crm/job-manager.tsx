"use client"

import { useState, useTransition } from "react"
import {
  updateJob,
  updateJobStatus,
  deleteJob,
} from "@/app/org/[slug]/jobs/actions"
import { localToUTC } from "@/app/lib/dates"

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
  job: Job
}

function toLocalInput(value: string | null) {
  if (!value) return ""

  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function JobManager({ slug, job }: Props) {
  const [title, setTitle] = useState(job.title)
  const [description, setDescription] = useState(job.description ?? "")
  const [status, setStatus] = useState<JobStatus>(job.status)
  const [start, setStart] = useState(toLocalInput(job.scheduled_start))
  const [end, setEnd] = useState(toLocalInput(job.scheduled_end))

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  function saveJob() {
    setError("")
    setSaved(false)

    startTransition(async () => {
      try {
        await updateJob(slug, job.id, {
          title,
          description,
          scheduledStart: localToUTC(start),
          scheduledEnd: localToUTC(end),
        })

        setSaved(true)
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
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to update status.",
        )
      }
    })
  }

  function removeJob() {
    if (!window.confirm("Delete this job permanently?")) {
      return
    }

    setError("")

    startTransition(async () => {
      try {
        await deleteJob(slug, job.id)
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to delete job.",
        )
      }
    })
  }

  return (
    <section className="space-y-5 rounded-lg border p-5">
      <h2 className="text-lg font-semibold">Manage Job</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium">Status</label>

        <select
          value={status}
          disabled={pending}
          onChange={(event) => changeStatus(event.target.value as JobStatus)}
          className="w-full rounded-md border p-3">
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>

        <input
          value={title}
          disabled={pending}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-md border p-3"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>

        <textarea
          value={description}
          disabled={pending}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="w-full rounded-md border p-3"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Scheduled Start</label>

          <input
            type="datetime-local"
            value={start}
            disabled={pending}
            onChange={(event) => setStart(event.target.value)}
            className="w-full rounded-md border p-3"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Scheduled End</label>

          <input
            type="datetime-local"
            value={end}
            disabled={pending}
            onChange={(event) => setEnd(event.target.value)}
            className="w-full rounded-md border p-3"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {saved && (
        <p role="status" className="text-sm text-green-600">
          Job updated successfully.
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={saveJob}
        className="rounded-md bg-black px-5 py-3 text-white disabled:opacity-50">
        {pending ? "Saving..." : "Save Changes"}
      </button>

      <div className="border-t pt-5">
        <button
          type="button"
          disabled={pending}
          onClick={removeJob}
          className="rounded-md border border-red-500 px-4 py-2 text-sm text-red-600 disabled:opacity-50">
          Delete Job
        </button>
      </div>
    </section>
  )
}
