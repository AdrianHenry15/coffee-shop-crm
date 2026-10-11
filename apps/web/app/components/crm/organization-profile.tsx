"use client"

import { useState, useTransition } from "react"
import { updateOrganizationProfile } from "@/app/org/[slug]/settings/actions"

type Profile = {
  name: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
}

type Props = {
  slug: string
  profile: Profile
  canEdit: boolean
}

export function OrganizationProfile({ slug, profile, canEdit }: Props) {
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    website: profile.website ?? "",
    address: profile.address ?? "",
  })

  const [saved, setSaved] = useState(form)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  const changed = JSON.stringify(form) !== JSON.stringify(saved)

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setSuccess(false)
  }

  function handleSave() {
    setError("")
    setSuccess(false)

    startTransition(async () => {
      try {
        await updateOrganizationProfile(slug, form)
        setSaved(form)
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save profile")
      }
    })
  }

  return (
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Business information
        </h2>

        <p className="mt-1 text-sm text-muted">
          {`Manage your organization's business details.`}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {(
          [
            ["name", "Business name"],
            ["email", "Business email"],
            ["phone", "Phone"],
            ["website", "Website"],
            ["address", "Address"],
          ] as const
        ).map(([field, label]) => (
          <label
            key={field}
            className={`block space-y-2 ${
              field === "name" || field === "address" ? "sm:col-span-2" : ""
            }`}>
            <span className="block text-sm font-medium text-foreground">
              {label}
              {field === "name" && <span className="ml-1 text-primary">*</span>}
            </span>

            <input
              type={
                field === "email"
                  ? "email"
                  : field === "website"
                    ? "url"
                    : "text"
              }
              value={form[field]}
              onChange={(event) => update(field, event.target.value)}
              disabled={!canEdit || pending}
              required={field === "name"}
              maxLength={field === "name" ? 200 : 500}
              className="w-full min-w-0 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      {success && !changed && (
        <p role="status" className="text-sm text-primary">
          Business information saved.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          {!canEdit ? (
            <p className="text-xs text-muted">
              Only the organization owner can edit business information.
            </p>
          ) : changed ? (
            <p className="text-xs text-muted">You have unsaved changes.</p>
          ) : (
            <p className="text-xs text-muted">
              Your business profile is up to date.
            </p>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !changed || !form.name.trim()}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? "Saving..." : "Save business information"}
          </button>
        )}
      </div>
    </section>
  )
}
