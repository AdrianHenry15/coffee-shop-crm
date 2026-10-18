"use client"

import { useId, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

export type ManagedContact = {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  status: string
  deleted_at: string | null
  lead_id?: string | null
  customers?: { id: string }[]
}

type BulkAction = (slug: string, ids: string[]) => Promise<number>
type Operation = "trash" | "restore" | "delete"

type ContactManagerProps = {
  slug: string
  entity: "leads" | "customers"
  contacts: ManagedContact[]
  onUpdate: (formData: FormData) => Promise<void>
  onConvert?: (formData: FormData) => Promise<void>
  onTrash: BulkAction
  onRestore: BulkAction
  onPermanentDelete: BulkAction
}

type Confirmation = {
  operation: Operation
  ids: string[]
}

const MAX_SELECTION = 500

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

const secondaryButton =
  "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"

const primaryButton =
  "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"

const dangerButton =
  "rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"

const statusStyles: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600",
  contacted: "bg-amber-500/10 text-amber-600",
  qualified: "bg-emerald-500/10 text-emerald-600",
  lost: "bg-red-500/10 text-red-600",
  active: "bg-emerald-500/10 text-emerald-600",
  inactive: "bg-surface-secondary text-muted",
}

export function ContactManager({
  slug,
  entity,
  contacts,
  onUpdate,
  onConvert,
  onTrash,
  onRestore,
  onPermanentDelete,
}: ContactManagerProps) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dialogTitleId = useId()
  const dialogDescriptionId = useId()

  const [view, setView] = useState<"active" | "deleted">("active")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [actionError, setActionError] = useState("")
  const [pending, startTransition] = useTransition()

  const isDeletedView = view === "deleted"
  const singular = entity === "leads" ? "lead" : "customer"

  const activeContacts = contacts.filter(
    (contact) => contact.deleted_at === null,
  )

  const deletedContacts = contacts.filter(
    (contact) => contact.deleted_at !== null,
  )

  const currentContacts = isDeletedView ? deletedContacts : activeContacts
  const query = search.trim().toLowerCase()

  const filtered = currentContacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(query) ||
      (contact.email ?? "").toLowerCase().includes(query) ||
      (contact.phone ?? "").toLowerCase().includes(query),
  )

  // Only visible selections participate in an operation.
  const selected = filtered
    .filter((contact) => selectedIds.has(contact.id))
    .map((contact) => contact.id)

  const selectionLimit = Math.min(filtered.length, MAX_SELECTION)
  const allSelected = selectionLimit > 0 && selected.length === selectionLimit

  function changeView(nextView: "active" | "deleted") {
    setView(nextView)
    setSelectedIds(new Set())
    setEditing(null)
  }

  function toggleContact(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)

      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < MAX_SELECTION) {
        next.add(id)
      }

      return next
    })
  }

  function toggleAll() {
    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(
            filtered.slice(0, MAX_SELECTION).map((contact) => contact.id),
          ),
    )
  }

  function requestOperation(operation: Operation, ids: string[]) {
    if (pending || ids.length === 0) return

    setActionError("")
    setConfirmation({ operation, ids: [...ids] })
    dialogRef.current?.showModal()
  }

  function closeConfirmation() {
    dialogRef.current?.close()
    setConfirmation(null)
    setActionError("")
  }

  function confirmOperation() {
    if (!confirmation || pending) return

    const { operation, ids } = confirmation

    startTransition(async () => {
      try {
        const action =
          operation === "trash"
            ? onTrash
            : operation === "restore"
              ? onRestore
              : onPermanentDelete

        const affected = await action(slug, ids)

        setSelectedIds(new Set())
        setEditing(null)
        closeConfirmation()

        if (affected === 0) {
          toast.info(
            "No contacts changed. The selection may already have been updated.",
          )
        } else {
          const label = affected === 1 ? singular : entity
          const message =
            operation === "trash"
              ? `Moved ${affected} ${label} to Recently Deleted.`
              : operation === "restore"
                ? `Restored ${affected} ${label}.`
                : `Permanently deleted ${affected} ${label}.`

          toast.success(message)
        }

        router.refresh()
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Unable to update the selected contacts.",
        )
      }
    })
  }

  function saveContact(formData: FormData) {
    startTransition(async () => {
      try {
        await onUpdate(formData)
        setEditing(null)
        toast.success("Contact updated successfully.")
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to update contact.",
        )
      }
    })
  }

  const confirmationCount = confirmation?.ids.length ?? 0

  const confirmationTitle =
    confirmation?.operation === "trash"
      ? `Move ${confirmationCount} ${confirmationCount === 1 ? singular : entity} to Recently Deleted?`
      : confirmation?.operation === "restore"
        ? `Restore ${confirmationCount} ${confirmationCount === 1 ? singular : entity}?`
        : `Permanently delete ${confirmationCount} ${confirmationCount === 1 ? singular : entity}?`

  const confirmationDescription =
    confirmation?.operation === "trash"
      ? "You can restore them later. They will still count toward your plan’s limit."
      : confirmation?.operation === "restore"
        ? "These contacts will return to your main list. Your plan usage will stay the same."
        : "This cannot be undone. Permanently deleting these contacts will free up space in your plan."

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Contact view"
        className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          aria-pressed={!isDeletedView}
          onClick={() => changeView("active")}
          className={!isDeletedView ? primaryButton : secondaryButton}>
          All {entity} ({activeContacts.length})
        </button>

        <button
          type="button"
          disabled={pending}
          aria-pressed={isDeletedView}
          onClick={() => changeView("deleted")}
          className={isDeletedView ? primaryButton : secondaryButton}>
          Recently Deleted ({deletedContacts.length})
        </button>
      </div>

      {isDeletedView && (
        <div className="rounded-xl border border-border bg-surface-secondary p-4">
          <p className="text-sm font-medium text-foreground">
            Deleted contacts still count toward your plan’s limit.
          </p>

          <p className="mt-1 text-sm text-muted">
            Restore them to use them again, or permanently delete them to free
            up space.
          </p>

          {entity === "customers" && (
            <p className="mt-2 text-sm text-muted">
              Customers linked to estimates or jobs cannot be permanently
              deleted. Permanent deletion also removes their activity history.
            </p>
          )}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
        <input
          type="search"
          value={search}
          disabled={pending}
          onChange={(event) => {
            setSearch(event.target.value)
            setSelectedIds(new Set())
          }}
          placeholder="Search by name, email, or phone..."
          aria-label={`Search ${isDeletedView ? "deleted " : ""}${entity}`}
          className={inputClass}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={pending || filtered.length === 0}
              onChange={toggleAll}
              className="size-4 accent-primary"
            />

            {filtered.length > MAX_SELECTION
              ? `Select first ${MAX_SELECTION} results`
              : "Select all results"}
          </label>

          <p className="font-mono text-xs text-muted">
            Showing {filtered.length} of {currentContacts.length}
            {selected.length > 0 ? ` · ${selected.length} selected` : ""}
          </p>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {isDeletedView ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => requestOperation("restore", selected)}
                  className={primaryButton}>
                  Restore selected ({selected.length})
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => requestOperation("delete", selected)}
                  className={dangerButton}>
                  Permanently delete selected ({selected.length})
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => requestOperation("trash", selected)}
                className={dangerButton}>
                Move selected to Recently Deleted ({selected.length})
              </button>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={() => setSelectedIds(new Set())}
              className={secondaryButton}>
              Clear selection
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-mono text-sm font-medium text-foreground">
            {query
              ? `No matching ${entity}`
              : isDeletedView
                ? "Recently Deleted is empty"
                : `No ${entity} yet`}
          </p>

          <p className="mt-2 text-sm text-muted">
            {query
              ? "Try another name, email, or phone."
              : isDeletedView
                ? "Contacts you delete will appear here."
                : `Add your first ${singular} using the form above.`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {filtered.map((contact) => {
            const checked = selectedIds.has(contact.id)
            const converted =
              entity === "leads"
                ? Boolean(contact.customers?.length)
                : Boolean(contact.lead_id)

            return (
              <div key={contact.id} className="p-5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={
                      pending || (!checked && selected.length >= MAX_SELECTION)
                    }
                    onChange={() => toggleContact(contact.id)}
                    aria-label={`Select ${contact.name}`}
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />

                  <div className="min-w-0 flex-1">
                    {editing === contact.id && !isDeletedView ? (
                      <form action={saveContact} className="space-y-4">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={contact.id} />

                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            name="name"
                            aria-label="Contact name"
                            defaultValue={contact.name}
                            required
                            maxLength={200}
                            disabled={pending}
                            className={inputClass}
                          />

                          <input
                            name="email"
                            type="email"
                            aria-label="Contact email"
                            defaultValue={contact.email ?? ""}
                            placeholder="Email"
                            disabled={pending}
                            className={inputClass}
                          />

                          <input
                            name="phone"
                            type="tel"
                            aria-label="Contact phone"
                            defaultValue={contact.phone ?? ""}
                            placeholder="Phone"
                            disabled={pending}
                            className={inputClass}
                          />

                          <select
                            name="status"
                            aria-label="Contact status"
                            defaultValue={contact.status}
                            disabled={pending}
                            className={inputClass}>
                            {(entity === "leads"
                              ? ["new", "contacted", "qualified", "lost"]
                              : ["active", "inactive"]
                            ).map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() +
                                  status.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <textarea
                          name="notes"
                          aria-label="Contact notes"
                          defaultValue={contact.notes ?? ""}
                          placeholder="Notes"
                          rows={3}
                          disabled={pending}
                          className={inputClass}
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={pending}
                            className={primaryButton}>
                            {pending ? "Saving..." : "Save changes"}
                          </button>

                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setEditing(null)}
                            className={secondaryButton}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                          {entity === "customers" && !isDeletedView ? (
                            <Link
                              href={`/org/${slug}/customers/${contact.id}`}
                              className="font-medium text-foreground hover:text-primary hover:underline">
                              {contact.name}
                            </Link>
                          ) : (
                            <p className="font-medium text-foreground">
                              {contact.name}
                            </p>
                          )}

                          <p className="wrap-break-word text-sm text-muted">
                            {contact.email ||
                              contact.phone ||
                              "No contact information"}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 font-mono text-xs font-medium ${
                                statusStyles[contact.status] ??
                                "bg-surface-secondary text-foreground"
                              }`}>
                              {contact.status.charAt(0).toUpperCase() +
                                contact.status.slice(1)}
                            </span>

                            {converted && (
                              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium text-primary">
                                Converted lead
                              </span>
                            )}
                          </div>

                          {isDeletedView && contact.deleted_at && (
                            <p className="text-xs text-muted">
                              Deleted{" "}
                              {new Date(contact.deleted_at).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  timeZone: "UTC",
                                },
                              )}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {isDeletedView ? (
                            <>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  requestOperation("restore", [contact.id])
                                }
                                className={secondaryButton}>
                                Restore
                              </button>

                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  requestOperation("delete", [contact.id])
                                }
                                className={dangerButton}>
                                Permanently delete
                              </button>
                            </>
                          ) : (
                            <>
                              {entity === "leads" &&
                                onConvert &&
                                !converted &&
                                contact.status !== "lost" && (
                                  <form action={onConvert}>
                                    <input
                                      type="hidden"
                                      name="slug"
                                      value={slug}
                                    />
                                    <input
                                      type="hidden"
                                      name="leadId"
                                      value={contact.id}
                                    />

                                    <button
                                      type="submit"
                                      disabled={pending}
                                      className={primaryButton}>
                                      Convert
                                    </button>
                                  </form>
                                )}

                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => setEditing(contact.id)}
                                className={secondaryButton}>
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  requestOperation("trash", [contact.id])
                                }
                                className={dangerButton}>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        onCancel={(event) => {
          event.preventDefault()

          if (!pending) {
            closeConfirmation()
          }
        }}
        className="fixed inset-0 m-auto w-11/12 max-w-lg rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/50">
        <h2 id={dialogTitleId} className="font-mono text-lg font-semibold">
          {confirmationTitle}
        </h2>

        <p id={dialogDescriptionId} className="mt-3 text-sm text-muted">
          {confirmationDescription}
        </p>

        {confirmation?.operation === "delete" && entity === "customers" && (
          <p className="mt-3 text-sm text-muted">
            Customers linked to estimates or jobs cannot be permanently deleted.
            Permanent deletion also removes customer activity history. If any
            selected customer is blocked, none of the selected customers will be
            permanently deleted.
          </p>
        )}

        {actionError && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {actionError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={closeConfirmation}
            className={secondaryButton}>
            Cancel
          </button>

          <button
            type="button"
            disabled={pending || !confirmation}
            onClick={confirmOperation}
            className={
              confirmation?.operation === "restore"
                ? primaryButton
                : dangerButton
            }>
            {pending
              ? "Processing..."
              : confirmation?.operation === "restore"
                ? "Restore contacts"
                : confirmation?.operation === "trash"
                  ? "Move to Recently Deleted"
                  : "Permanently delete"}
          </button>
        </div>
      </dialog>
    </div>
  )
}
