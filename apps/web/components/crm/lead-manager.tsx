"use client"

import { useState } from "react"
import { deleteLead, updateLead } from "@/app/org/[slug]/leads/actions"

type Lead = {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  status: string
}

type Props = {
  slug: string
  leads: Lead[]
}

const statuses = ["new", "contacted", "qualified", "lost"]

export function LeadManager({ slug, leads }: Props) {
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<string | null>(null)

  const filtered = leads.filter((lead) => {
    const query = search.toLowerCase()

    return (
      lead.name.toLowerCase().includes(query) ||
      (lead.email ?? "").toLowerCase().includes(query) ||
      (lead.phone ?? "").includes(query)
    )
  })

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search leads..."
        className="w-full rounded-md border p-3"
      />

      {!filtered.length ? (
        <p className="rounded-md border p-5 text-gray-500">
          No matching leads found.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((lead) => (
            <div key={lead.id} className="p-5">
              {editing === lead.id ? (
                <form
                  action={async (formData) => {
                    await updateLead(formData)
                    setEditing(null)
                  }}
                  className="space-y-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={lead.id} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      name="name"
                      defaultValue={lead.name}
                      required
                      maxLength={200}
                      className="rounded-md border p-3"
                    />

                    <input
                      name="email"
                      type="email"
                      defaultValue={lead.email ?? ""}
                      placeholder="Email"
                      className="rounded-md border p-3"
                    />

                    <input
                      name="phone"
                      defaultValue={lead.phone ?? ""}
                      placeholder="Phone"
                      className="rounded-md border p-3"
                    />

                    <select
                      name="status"
                      defaultValue={lead.status}
                      className="rounded-md border p-3">
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    name="notes"
                    defaultValue={lead.notes ?? ""}
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
                  <div>
                    <p className="font-medium">{lead.name}</p>

                    <p className="text-sm text-gray-500">
                      {lead.email || lead.phone || "No contact information"}
                    </p>

                    <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-black">
                      {lead.status}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(lead.id)}
                      className="rounded-md border px-3 py-2 text-sm">
                      Edit
                    </button>

                    <form
                      action={deleteLead}
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            `Delete ${lead.name}? This cannot be undone.`,
                          )
                        ) {
                          event.preventDefault()
                        }
                      }}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="id" value={lead.id} />

                      <button
                        type="submit"
                        className="rounded-md border px-3 py-2 text-sm text-red-600">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
