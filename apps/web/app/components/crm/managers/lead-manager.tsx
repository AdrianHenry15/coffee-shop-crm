"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  deleteLead,
  updateLead,
  convertLead,
} from "@/app/org/[slug]/leads/actions"
import { ConfirmDialog } from "../ui/confirm-dialog"
import { toast } from "sonner"

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

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

const secondaryButton =
  "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-50"

const primaryButton =
  "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"

const statusStyles: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500",
  contacted: "bg-amber-500/10 text-amber-500",
  qualified: "bg-emerald-500/10 text-emerald-500",
  lost: "bg-red-500/10 text-red-500",
}

export function LeadManager({ slug, leads }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

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
    startSaveTransition(async () => {
      try {
        await updateLead(formData)

        setEditing(null)
        toast.success("Lead updated successfully.")
        router.refresh()
      } catch (error) {
        toast.error(
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

    startTransition(async () => {
      try {
        await deleteLead(formData)

        setSelectedLead(null)
        toast.success("Lead deleted successfully.")
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to delete lead.",
        )
      }
    })
  }

  function handleConversion(formData: FormData) {
    startTransition(async () => {
      try {
        await convertLead(formData)
      } catch (error) {
        if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
          throw error
        }

        toast.error(
          error instanceof Error ? error.message : "Unable to convert lead.",
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
          aria-label="Search leads"
          className={inputClass}
        />
        <p className="mt-2 font-mono text-xs text-muted">
          Showing {filtered.length} of {leads.length} leads
        </p>
      </div>

      {!filtered.length ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-mono text-sm font-medium text-foreground">
            {search.trim() ? "No matching leads" : "No leads yet"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {search.trim()
              ? "Try searching for a different name, email, or phone."
              : "Add your first lead using the form above."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {filtered.map((lead) => {
            const isConverted = (lead.customers?.length ?? 0) > 0

            return (
              <div key={lead.id} className="p-5">
                {editing === lead.id ? (
                  <form action={saveLead} className="space-y-4">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={lead.id} />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        name="name"
                        aria-label="Lead name"
                        defaultValue={lead.name}
                        required
                        maxLength={200}
                        disabled={saving}
                        className={inputClass}
                      />

                      <input
                        name="email"
                        type="email"
                        aria-label="Lead email"
                        defaultValue={lead.email ?? ""}
                        placeholder="Email"
                        disabled={saving}
                        className={inputClass}
                      />

                      <input
                        name="phone"
                        type="tel"
                        aria-label="Lead phone"
                        defaultValue={lead.phone ?? ""}
                        placeholder="Phone"
                        disabled={saving}
                        className={inputClass}
                      />

                      <select
                        name="status"
                        aria-label="Lead status"
                        defaultValue={lead.status}
                        disabled={saving}
                        className={inputClass}>
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <textarea
                      name="notes"
                      aria-label="Lead notes"
                      defaultValue={lead.notes ?? ""}
                      placeholder="Notes"
                      rows={3}
                      disabled={saving}
                      className={inputClass}
                    />

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
                        }}
                        className={secondaryButton}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <p className="font-medium text-foreground">{lead.name}</p>

                      <p className="wrap-break-word text-sm text-muted">
                        {lead.email || lead.phone || "No contact information"}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 font-mono text-xs font-medium ${
                            statusStyles[lead.status] ??
                            "bg-surface-secondary text-foreground"
                          }`}>
                          {lead.status.charAt(0).toUpperCase() +
                            lead.status.slice(1)}
                        </span>

                        {isConverted && (
                          <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium text-primary">
                            Converted
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isConverted && lead.status !== "lost" && (
                        <form action={handleConversion}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="leadId" value={lead.id} />

                          <button
                            type="submit"
                            disabled={pending || saving}
                            className={primaryButton}>
                            Convert
                          </button>
                        </form>
                      )}

                      <button
                        type="button"
                        disabled={pending || saving}
                        onClick={() => {
                          setEditing(lead.id)
                        }}
                        className={secondaryButton}>
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={pending || saving}
                        onClick={() => {
                          setSelectedLead(lead)
                        }}
                        className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50">
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
        error={""}
        onCancel={() => {
          setSelectedLead(null)
        }}
        onConfirm={removeLead}
      />
    </div>
  )
}
