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

export function JobForm({ slug, timezone, customers, estimates }: Props) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "")

  const availableEstimates = estimates.filter(
    (estimate) => estimate.customer_id === customerId,
  )

  function handleSubmit(formData: FormData) {
    const start = String(formData.get("scheduledStart") ?? "")
    const end = String(formData.get("scheduledEnd") ?? "")

    if (start) {
      formData.set("scheduledStart", organizationTimeToUTC(start, timezone))
    }

    if (end) {
      formData.set("scheduledEnd", organizationTimeToUTC(end, timezone))
    }

    return createJob(formData)
  }

  return (
    <form action={handleSubmit} className="space-y-5 rounded-lg border p-5">
      <h2 className="text-lg font-semibold">Create Job</h2>

      <input type="hidden" name="slug" value={slug} />

      <div className="space-y-2">
        <label className="text-sm font-medium">Customer</label>

        <select
          name="customerId"
          required
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          className="w-full rounded-md border p-3">
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Accepted Estimate (Optional)
        </label>

        <select
          key={customerId}
          name="estimateId"
          className="w-full rounded-md border p-3">
          <option value="">No estimate</option>

          {availableEstimates.map((estimate) => (
            <option key={estimate.id} value={estimate.id}>
              Estimate {estimate.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Job Title</label>

        <input
          name="title"
          required
          maxLength={200}
          placeholder="Exterior House Cleaning"
          className="w-full rounded-md border p-3"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>

        <textarea
          name="description"
          rows={3}
          placeholder="Work details..."
          className="w-full rounded-md border p-3"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Start</label>

          <input
            type="datetime-local"
            name="scheduledStart"
            className="w-full rounded-md border p-3"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">End</label>

          <input
            type="datetime-local"
            name="scheduledEnd"
            className="w-full rounded-md border p-3"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={customers.length === 0}
        className="rounded-md bg-black px-5 py-3 text-white disabled:opacity-50">
        Create Job
      </button>

      {customers.length === 0 && (
        <p className="text-sm text-gray-500">
          Create a customer before adding jobs.
        </p>
      )}
    </form>
  )
}
