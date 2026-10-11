"use client"

import { useState } from "react"
import { createJob } from "@/app/org/[slug]/jobs/actions"
import { organizationTimeToUTC } from "@/app/lib/dates"

type Customer = {
  id: string
  name: string
}

type Estimate = {
  id: string
  customer_id: string
}

type Props = {
  slug: string
  timezone: string
  customers: Customer[]
  estimates: Estimate[]
}

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
export function JobForm({ slug, timezone, customers, estimates }: Props) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "")
  const [scheduleError, setScheduleError] = useState("")

  const availableEstimates = estimates.filter(
    (estimate) => estimate.customer_id === customerId,
  )

  function handleSubmit(formData: FormData) {
    setScheduleError("")

    const start = String(formData.get("scheduledStart") ?? "")
    const end = String(formData.get("scheduledEnd") ?? "")

    if (start && end && end <= start) {
      setScheduleError("End time must be after start time.")
      return
    }

    if (start) {
      formData.set("scheduledStart", organizationTimeToUTC(start, timezone))
    }

    if (end) {
      formData.set("scheduledEnd", organizationTimeToUTC(end, timezone))
    }

    return createJob(formData)
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="job-customer"
            className="block text-sm font-medium text-foreground">
            Customer
          </label>

          <select
            id="job-customer"
            name="customerId"
            required
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className={inputClass}>
            {customers.length === 0 && (
              <option value="">No customers available</option>
            )}

            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="job-estimate"
            className="block text-sm font-medium text-foreground">
            Accepted estimate
            <span className="ml-2 font-normal text-muted">(Optional)</span>
          </label>

          <select
            id="job-estimate"
            key={customerId}
            name="estimateId"
            className={inputClass}>
            <option value="">No estimate</option>

            {availableEstimates.map((estimate) => (
              <option key={estimate.id} value={estimate.id}>
                Estimate {estimate.id.slice(0, 8)}
              </option>
            ))}
          </select>

          <p className="text-xs text-muted">
            Only accepted estimates not already linked to a job are shown.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="job-title"
          className="block text-sm font-medium text-foreground">
          Job title
        </label>

        <input
          id="job-title"
          name="title"
          required
          maxLength={200}
          placeholder="Exterior house cleaning"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="job-description"
          className="block text-sm font-medium text-foreground">
          Description
        </label>

        <textarea
          id="job-description"
          name="description"
          rows={3}
          placeholder="Describe the work to be completed..."
          className={inputClass}
        />
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <div>
          <h3 className="font-mono text-base font-semibold text-foreground">
            Schedule
          </h3>

          <p className="mt-1 text-sm text-muted">
            Set the planned start and end times for this job.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="job-start"
              className="block text-sm font-medium text-foreground">
              Start
            </label>

            <input
              id="job-start"
              type="datetime-local"
              name="scheduledStart"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="job-end"
              className="block text-sm font-medium text-foreground">
              End
            </label>

            <input
              id="job-end"
              type="datetime-local"
              name="scheduledEnd"
              className={inputClass}
            />
          </div>
        </div>
        {scheduleError && (
          <p role="alert" className="text-sm text-red-500">
            {scheduleError}
          </p>
        )}

        <p className="text-xs text-muted">
          Times are entered in your organization&apos;s timezone.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        {customers.length === 0 ? (
          <p className="text-sm text-muted">
            Create a customer before adding jobs.
          </p>
        ) : (
          <p className="text-xs text-muted">
            Jobs can be scheduled now or updated later.
          </p>
        )}

        <button
          type="submit"
          disabled={customers.length === 0}
          className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
          Create job
        </button>
      </div>
    </form>
  )
}
