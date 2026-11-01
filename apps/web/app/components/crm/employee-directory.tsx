"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveEmployee } from "@/app/org/[slug]/employees/actions"

type Employee = {
  id: string
  name: string
  email: string | null
  phone: string | null
  job_title: string | null
  status: string
  membership_id: string | null
  updated_at: string
}

type Account = {
  id: string
  label: string
  status: string
}

export function EmployeeDirectory({
  slug,
  employees,
  accounts,
}: {
  slug: string
  employees: Employee[]
  accounts: Account[]
}) {
  const [editor, setEditor] = useState<string | null>(null)

  const selectedEmployee = employees.find((employee) => employee.id === editor)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          Employee records do not grant login access or consume login seats.
        </p>

        <button
          type="button"
          onClick={() => setEditor("new")}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Add employee
        </button>
      </div>

      {(editor === "new" || selectedEmployee) && (
        <EmployeeForm
          key={
            selectedEmployee
              ? `${selectedEmployee.id}:${selectedEmployee.updated_at}`
              : "new"
          }
          slug={slug}
          employee={selectedEmployee}
          accounts={accounts}
          onClose={() => setEditor(null)}
        />
      )}

      {employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-medium text-foreground">No employees yet</p>
          <p className="mt-2 text-sm text-muted">
            Add someone to your staff directory without requiring an account.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface px-5">
          {employees.map((employee) => {
            const account = accounts.find(
              (entry) => entry.id === employee.membership_id,
            )

            return (
              <div
                key={employee.id}
                className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="wrap-break-word font-semibold text-foreground">
                      {employee.name}
                    </h2>

                    <span className="rounded-full border border-border px-2 py-1 text-xs capitalize text-muted">
                      {employee.status}
                    </span>
                  </div>

                  {employee.job_title && (
                    <p className="text-sm text-muted">{employee.job_title}</p>
                  )}

                  {employee.email && (
                    <p className="wrap-break-word text-sm text-muted">
                      {employee.email}
                    </p>
                  )}

                  {employee.phone && (
                    <p className="text-sm text-muted">{employee.phone}</p>
                  )}

                  <p className="text-xs text-muted">
                    {employee.membership_id
                      ? `Linked account: ${account?.label ?? "Workspace member"} (${account?.status ?? "unknown"})`
                      : "No workspace account linked"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditor(employee.id)}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                  Edit
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmployeeForm({
  slug,
  employee,
  accounts,
  onClose,
}: {
  slug: string
  employee?: Employee
  accounts: Account[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const availableAccounts = accounts.filter(
    (account) =>
      account.status === "active" || account.id === employee?.membership_id,
  )

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <h2 className="font-mono text-lg font-semibold text-foreground">
        {employee ? "Edit employee" : "Add employee"}
      </h2>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (pending) return

          const formData = new FormData(event.currentTarget)
          setError(null)

          startTransition(async () => {
            try {
              const result = await saveEmployee(
                slug,
                employee?.id ?? null,
                employee?.updated_at ?? null,
                formData,
              )

              if (result.error) {
                setError(result.error)
                return
              }

              if (!result.saved) {
                setError("Unable to confirm the employee was saved.")
                return
              }

              onClose()
              router.refresh()
            } catch {
              setError("Unable to save the employee. Please try again.")
            }
          })
        }}>
        <fieldset disabled={pending} className="space-y-4">
          <label className="block space-y-1 text-sm text-foreground">
            <span>Name *</span>
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={employee?.name ?? ""}
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm text-foreground">
              <span>Email</span>
              <input
                name="email"
                type="email"
                maxLength={254}
                defaultValue={employee?.email ?? ""}
                className={inputClass}
              />
            </label>

            <label className="block space-y-1 text-sm text-foreground">
              <span>Phone</span>
              <input
                name="phone"
                type="tel"
                maxLength={50}
                defaultValue={employee?.phone ?? ""}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm text-foreground">
            <span>Job title</span>
            <input
              name="jobTitle"
              maxLength={120}
              defaultValue={employee?.job_title ?? ""}
              className={inputClass}
            />
          </label>

          <label className="block space-y-1 text-sm text-foreground">
            <span>Employee status</span>
            <select
              name="status"
              defaultValue={employee?.status ?? "active"}
              className={inputClass}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <p className="text-xs text-muted">
            Employee status does not change workspace login access.
          </p>

          <label className="block space-y-1 text-sm text-foreground">
            <span>Linked workspace account</span>
            <select
              name="membershipId"
              defaultValue={employee?.membership_id ?? ""}
              className={inputClass}>
              <option value="">None — employee record only</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label} ({account.status})
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-muted">
            Optional. Link an existing member after they join the workspace.
            Each account can link to one employee. Invitations and login
            permissions are managed in Settings.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              {pending ? "Saving..." : "Save employee"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">
              Cancel
            </button>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
