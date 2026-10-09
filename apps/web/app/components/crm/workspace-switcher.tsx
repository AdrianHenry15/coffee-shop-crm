"use client"

import { useRouter } from "next/navigation"

type Organization = {
  id: string
  name: string
  slug: string
}

type Props = {
  currentSlug: string
  organizations: Organization[]
}

export function WorkspaceSwitcher({ currentSlug, organizations }: Props) {
  const router = useRouter()

  return (
    <select
      value={currentSlug}
      onChange={(event) => {
        router.push(`/org/${event.target.value}/dashboard`)
      }}
      aria-label="Select workspace"
      className="w-full rounded-md border bg-white p-2 text-sm text-black">
      {organizations.map((organization) => (
        <option key={organization.id} value={organization.slug}>
          {organization.name}
        </option>
      ))}
    </select>
  )
}
