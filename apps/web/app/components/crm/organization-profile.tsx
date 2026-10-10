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
    <section className="max-w-xl space-y-5 rounded-lg border p-6">
      <div>
        <h2 className="font-semibold">Business Information</h2>
        <p className="mt-1 text-sm text-gray-500">
          {`Manage your organization's business details.`}
        </p>
      </div>

      {(
        [
          ["name", "Business Name"],
          ["email", "Business Email"],
          ["phone", "Phone"],
          ["website", "Website"],
          ["address", "Address"],
        ] as const
      ).map(([field, label]) => (
        <label key={field} className="block space-y-2">
          <span className="text-sm font-medium">{label}</span>

          <input
            type={
              field === "email" ? "email" : field === "website" ? "url" : "text"
            }
            value={form[field]}
            onChange={(event) => update(field, event.target.value)}
            disabled={!canEdit || pending}
            required={field === "name"}
            maxLength={field === "name" ? 200 : 500}
            className="w-full rounded-md border bg-transparent p-3 text-sm disabled:opacity-60"
          />
        </label>
      ))}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {success && !changed && (
        <p className="text-sm text-green-600">Business information saved.</p>
      )}

      {canEdit ? (
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !changed || !form.name.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Saving..." : "Save Business Information"}
        </button>
      ) : (
        <p className="text-xs text-gray-500">
          Only the organization owner can edit business information.
        </p>
      )}
    </section>
  )
}
