"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  updateCustomer,
  deleteCustomer,
} from "@/app/org/[slug]/customers/actions"
import { ConfirmDialog } from "../ui/confirm-dialog"

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  status: string
  lead_id: string | null
}

type Props = {
  slug: string
  customers: Customer[]
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

const secondaryButton =
  "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-50"

const primaryButton =
  "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  inactive: "bg-gray-500/10 text-muted",
}

export function CustomerManager({ slug, customers }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [editError, setEditError] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState("")

  const [pending, startTransition] = useTransition()
  const [saving, startSaveTransition] = useTransition()

  const filtered = customers.filter((customer) => {
    const query = search.trim().toLowerCase()

    return (
      customer.name.toLowerCase().includes(query) ||
      (customer.email ?? "").toLowerCase().includes(query) ||
      (customer.phone ?? "").includes(query)
    )
  })

  function saveCustomer(formData: FormData) {
    setEditError("")

    startSaveTransition(async () => {
      try {
        await updateCustomer(formData)
        setEditing(null)
        router.refresh()
      } catch (error) {
        setEditError(
          error instanceof Error ? error.message : "Unable to update customer.",
        )
      }
    })
  }

  function removeCustomer() {
    if (!selectedCustomer) return

    setDeleteError("")

    const formData = new FormData()
    formData.set("slug", slug)
    formData.set("id", selectedCustomer.id)

    startTransition(async () => {
      try {
        await deleteCustomer(formData)
        setSelectedCustomer(null)
        router.refresh()
      } catch (error) {
        setDeleteError(
          error instanceof Error ? error.message : "Unable to delete customer.",
        )
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, or phone..."
          aria-label="Search customers"
          className={inputClass}
        />

        <p className="mt-2 font-mono text-xs text-muted">
          Showing {filtered.length} of {customers.length} customers
        </p>
      </div>

      {!filtered.length ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-mono text-sm font-medium text-foreground">
            {search.trim() ? "No matching customers" : "No customers yet"}
          </p>

          <p className="mt-2 text-sm text-muted">
            {search.trim()
              ? "Try searching for a different name, email, or phone."
              : "Add your first customer using the form above."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {filtered.map((customer) => (
            <div key={customer.id} className="p-5">
              {editing === customer.id ? (
                <form action={saveCustomer} className="space-y-4">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={customer.id} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      name="name"
                      aria-label="Customer name"
                      defaultValue={customer.name}
                      required
                      maxLength={200}
                      disabled={saving}
                      className={inputClass}
                    />

                    <input
                      name="email"
                      type="email"
                      aria-label="Customer email"
                      defaultValue={customer.email ?? ""}
                      placeholder="Email"
                      disabled={saving}
                      className={inputClass}
                    />

                    <input
                      name="phone"
                      type="tel"
                      aria-label="Customer phone"
                      defaultValue={customer.phone ?? ""}
                      placeholder="Phone"
                      disabled={saving}
                      className={inputClass}
                    />

                    <select
                      name="status"
                      aria-label="Customer status"
                      defaultValue={customer.status}
                      disabled={saving}
                      className={inputClass}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <textarea
                    name="notes"
                    aria-label="Customer notes"
                    defaultValue={customer.notes ?? ""}
                    placeholder="Notes"
                    rows={3}
                    disabled={saving}
                    className={inputClass}
                  />

                  {editError && (
                    <p role="alert" className="text-sm text-red-500">
                      {editError}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className={primaryButton}>
                      {saving ? "Saving..." : "Save changes"}
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setEditing(null)
                        setEditError("")
                      }}
                      className={secondaryButton}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <Link
                      href={`/org/${slug}/customers/${customer.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline">
                      {customer.name}
                    </Link>

                    <p className="wrap-break-word text-sm text-muted">
                      {customer.email ||
                        customer.phone ||
                        "No contact information"}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 font-mono text-xs font-medium ${
                          statusStyles[customer.status] ??
                          "bg-surface-secondary text-foreground"
                        }`}>
                        {customer.status.charAt(0).toUpperCase() +
                          customer.status.slice(1)}
                      </span>

                      {customer.lead_id && (
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium text-primary">
                          Converted lead
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={pending || saving}
                      onClick={() => {
                        setEditError("")
                        setEditing(customer.id)
                      }}
                      className={secondaryButton}>
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={pending || saving}
                      onClick={() => {
                        setDeleteError("")
                        setSelectedCustomer(customer)
                      }}
                      className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={selectedCustomer !== null}
        title={`Delete ${selectedCustomer?.name ?? "Customer"}?`}
        description="This will permanently delete the customer. This action cannot be undone. Customers with linked estimates or jobs may not be deletable."
        pending={pending}
        error={deleteError}
        onCancel={() => {
          setSelectedCustomer(null)
          setDeleteError("")
        }}
        onConfirm={removeCustomer}
      />
    </div>
  )
}
