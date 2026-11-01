"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { changeJobEmployeeAssignment } from "@/app/org/[slug]/jobs/assignment-actions"

type Employee = {
  id: string
  name: string
  status: string
}

export function JobEmployeeAssignments({
  slug,
  jobId,
  assigned,
  available,
}: {
  slug: string
  jobId: string
  assigned: Employee[]
  available: Employee[]
}) {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function run(id: string, operation: "assign" | "unassign") {
    if (pending || !id) return

    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const result = await changeJobEmployeeAssignment(
          slug,
          jobId,
          id,
          operation,
        )

        if (result.error) {
          setError(result.error)
          return
        }

        if (!result.success) {
          setError("Unable to confirm the assignment change.")
          return
        }

        setEmployeeId("")
        setMessage(
          operation === "assign"
            ? "Employee assigned."
            : "Employee unassigned.",
        )
        router.refresh()
      } catch {
        setError("Unable to update the assignment. Please try again.")
      }
    })
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-surface p-6">
      <div className="space-y-2">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Assigned employees
        </h2>

        <p className="text-sm text-muted">
          Assign staff to this job. Employees do not need a CoffeeShop account.
        </p>
      </div>

      {assigned.length === 0 ? (
        <p className="text-sm text-muted">No employees assigned yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {assigned.map((employee) => (
            <li
              key={employee.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="space-y-1">
                <p className="wrap-break-word text-sm font-medium text-foreground">
                  {employee.name}
                </p>

                {employee.status !== "active" && (
                  <p className="text-xs text-muted">
                    Inactive employee · Existing assignment retained
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={pending}
                onClick={() => run(employee.id, "unassign")}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50">
                Unassign
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="space-y-3 border-t border-border pt-4"
        onSubmit={(event) => {
          event.preventDefault()
          run(employeeId, "assign")
        }}>
        <label className="block space-y-1 text-sm text-foreground">
          <span>Add employee to job</span>
          <select
            required
            value={employeeId}
            disabled={pending || available.length === 0}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-50">
            <option value="">Select an active employee</option>

            {available.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>

        {available.length === 0 && (
          <p className="text-xs text-muted">
            No unassigned active employees are available.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending || !employeeId || available.length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {pending ? "Updating..." : "Assign employee"}
          </button>

          <Link
            href={`/org/${slug}/employees`}
            className="text-sm text-primary hover:underline">
            Manage employees
          </Link>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
    </section>
  )
}
