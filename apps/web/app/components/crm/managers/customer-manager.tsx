"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  updateCustomer,
  deleteCustomer,
} from "@/app/org/[slug]/customers/actions"
import { ConfirmDialog } from "../ui/confirm-dialog"
import Link from "next/link"

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

export function CustomerManager({ slug, customers }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState("")
  const [pending, startTransition] = useTransition()

  const filtered = customers.filter((customer) => {
    const query = search.toLowerCase()

    return (
      customer.name.toLowerCase().includes(query) ||
      (customer.email ?? "").toLowerCase().includes(query) ||
      (customer.phone ?? "").includes(query)
    )
  })

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
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search customers..."
        className="w-full rounded-md border p-3"
      />

      {!filtered.length ? (
        <p className="rounded-md border p-5 text-gray-500">
          No matching customers found.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((customer) => (
            <div key={customer.id} className="p-5">
              {editing === customer.id ? (
                <form
                  action={async (formData) => {
                    await updateCustomer(formData)
                    setEditing(null)
                  }}
                  className="space-y-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={customer.id} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      name="name"
                      defaultValue={customer.name}
                      required
                      maxLength={200}
                      className="rounded-md border p-3"
                    />

                    <input
                      name="email"
                      type="email"
                      defaultValue={customer.email ?? ""}
                      placeholder="Email"
                      className="rounded-md border p-3"
                    />

                    <input
                      name="phone"
                      defaultValue={customer.phone ?? ""}
                      placeholder="Phone"
                      className="rounded-md border p-3"
                    />

                    <select
                      name="status"
                      defaultValue={customer.status}
                      className="rounded-md border p-3">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <textarea
                    name="notes"
                    defaultValue={customer.notes ?? ""}
                    placeholder="Notes"
                    rows={3}
                    className="w-full rounded-md border p-3"
                  />

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md bg-black px-4 py-2 text-white">
                      Save
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-md border px-4 py-2">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Link
                      href={`/org/${slug}/customers/${customer.id}`}
                      className="font-medium hover:underline">
                      {customer.name}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {customer.email ||
                        customer.phone ||
                        "No contact information"}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-black">
                        {customer.status}
                      </span>

                      {customer.lead_id && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-800">
                          Converted lead
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(customer.id)}
                      className="rounded-md border px-3 py-2 text-sm">
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setDeleteError("")
                        setSelectedCustomer(customer)
                      }}
                      className="rounded-md border px-3 py-2 text-sm text-red-600 disabled:opacity-50">
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
