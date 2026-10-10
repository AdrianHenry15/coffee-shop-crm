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
      className="
        w-full rounded-lg
        border border-sidebar-muted/30
        bg-white/10 px-3 py-2.5
        text-sm text-sidebar-foreground
        outline-none transition-colors
        hover:bg-white/15
        focus:border-sidebar-foreground
        focus:ring-2 focus:ring-sidebar-foreground/20
      ">
      {organizations.map((organization) => (
        <option
          key={organization.id}
          value={organization.slug}
          className="bg-sidebar text-sidebar-foreground">
          {organization.name}
        </option>
      ))}
    </select>
  )
}
