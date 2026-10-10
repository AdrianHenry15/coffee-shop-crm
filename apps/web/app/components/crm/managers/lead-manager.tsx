"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  deleteLead,
  updateLead,
  convertLead,
} from "@/app/org/[slug]/leads/actions"
import { ConfirmDialog } from "../ui/confirm-dialog"

type Lead = {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  status: string
  customers: { id: string }[]
}

type Props = {
  slug: string
  leads: Lead[]
}

const statuses = ["new", "contacted", "qualified", "lost"]

export function LeadManager({ slug, leads }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [editError, setEditError] = useState("")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [deleteError, setDeleteError] = useState("")

  const [pending, startTransition] = useTransition()
  const [saving, startSaveTransition] = useTransition()

  const filtered = leads.filter((lead) => {
    const query = search.trim().toLowerCase()

    return (
      lead.name.toLowerCase().includes(query) ||
      (lead.email ?? "").toLowerCase().includes(query) ||
      (lead.phone ?? "").includes(query)
    )
  })

  function saveLead(formData: FormData) {
    setEditError("")

    startSaveTransition(async () => {
      try {
        await updateLead(formData)
        setEditing(null)
        router.refresh()
      } catch (error) {
        setEditError(
          error instanceof Error ? error.message : "Unable to update lead.",
        )
      }
    })
  }

  function removeLead() {
    if (!selectedLead) return

    const formData = new FormData()
    formData.set("slug", slug)
    formData.set("id", selectedLead.id)

    setDeleteError("")

    startTransition(async () => {
      try {
        await deleteLead(formData)
        setSelectedLead(null)
        router.refresh()
      } catch (error) {
        setDeleteError(
          error instanceof Error ? error.message : "Unable to delete lead.",
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
        placeholder="Search leads..."
        className="w-full rounded-md border p-3"
      />

      {!filtered.length ? (
        <p className="rounded-md border p-5 text-gray-500">
          No matching leads found.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((lead) => {
            const isConverted = (lead.customers?.length ?? 0) > 0

            return (
              <div key={lead.id} className="p-5">
                {editing === lead.id ? (
                  <form action={saveLead} className="space-y-3">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={lead.id} />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        name="name"
                        defaultValue={lead.name}
                        required
                        maxLength={200}
                        disabled={saving}
                        className="rounded-md border p-3"
                      />

                      <input
                        name="email"
                        type="email"
                        defaultValue={lead.email ?? ""}
                        placeholder="Email"
                        disabled={saving}
                        className="rounded-md border p-3"
                      />

                      <input
                        name="phone"
                        defaultValue={lead.phone ?? ""}
                        placeholder="Phone"
                        disabled={saving}
                        className="rounded-md border p-3"
                      />

                      <select
                        name="status"
                        defaultValue={lead.status}
                        disabled={saving}
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
                      disabled={saving}
                      className="w-full rounded-md border p-3"
                    />

                    {editError && (
                      <p role="alert" className="text-sm text-red-600">
                        {editError}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50">
                        {saving ? "Saving..." : "Save"}
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setEditing(null)
                          setEditError("")
                        }}
                        className="rounded-md border px-4 py-2 disabled:opacity-50">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-2">
                      <p className="font-medium">{lead.name}</p>

                      <p className="text-sm text-gray-500">
                        {lead.email || lead.phone || "No contact information"}
                      </p>

                      <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-black">
                        {lead.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isConverted && (
                        <span className="text-xs text-green-700">
                          Converted
                        </span>
                      )}

                      {!isConverted && lead.status !== "lost" && (
                        <form action={convertLead}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="leadId" value={lead.id} />

                          <button
                            type="submit"
                            disabled={pending || saving}
                            className="rounded-md bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50">
                            Convert
                          </button>
                        </form>
                      )}

                      <button
                        type="button"
                        disabled={pending || saving}
                        onClick={() => {
                          setEditError("")
                          setEditing(lead.id)
                        }}
                        className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={pending || saving}
                        onClick={() => {
                          setSelectedLead(lead)
                          setDeleteError("")
                        }}
                        className="rounded-md border px-3 py-2 text-sm text-red-600 disabled:opacity-50">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={selectedLead !== null}
        title={`Delete ${selectedLead?.name ?? "Lead"}?`}
        description="This will permanently delete the lead. Any customer converted from this lead will remain in the CRM."
        pending={pending}
        error={deleteError}
        onCancel={() => {
          setSelectedLead(null)
          setDeleteError("")
        }}
        onConfirm={removeLead}
      />
    </div>
  )
}
