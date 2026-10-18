"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { WorkspaceSwitcher } from "./workspace-switcher"
import { logout } from "@/app/auth/actions"
import { ThemeSwitcher } from "./theme-switcher"

type Organization = {
  id: string
  name: string
  slug: string
}

type Props = {
  currentSlug: string
  organizations: Organization[]
}

const navigation = [
  { label: "Dashboard", path: "dashboard" },
  { label: "Leads", path: "leads" },
  { label: "Customers", path: "customers" },
  { label: "Estimates", path: "estimates" },
  { label: "Jobs", path: "jobs" },
  { label: "Catalog", path: "catalog" },
  { label: "Schedule", path: "schedule" },
  { label: "Settings", path: "settings" },
]

export function Sidebar({ currentSlug, organizations }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-border bg-surface p-4 md:hidden">
        <Link href="/dashboard" className="font-semibold">
          CoffeeShopCRM
        </Link>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="crm-sidebar"
          onClick={() => setOpen(!open)}
          className="rounded-md border border-border px-3 py-2">
          {open ? "Close" : "Menu"}
        </button>
      </header>

      {/* Mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        id="crm-sidebar"
        className={`
  fixed inset-y-0 left-0 z-50 flex w-64
  flex-col border-r border-white/10
  bg-sidebar p-5 text-sidebar-foreground
  transition-transform duration-200
  md:sticky md:top-0 md:h-screen md:translate-x-0
  ${open ? "translate-x-0" : "-translate-x-full"}
`}>
        <Link
          href="/dashboard"
          className="text-lg font-bold"
          onClick={() => setOpen(false)}>
          CoffeeShop
        </Link>

        <div className="mt-6">
          <WorkspaceSwitcher
            currentSlug={currentSlug}
            organizations={organizations}
          />
        </div>

        <nav className="mt-8 flex-1 space-y-1">
          {navigation.map((item) => {
            const href = `/org/${currentSlug}/${item.path}`
            const active = pathname === href || pathname.startsWith(`${href}/`)

            return (
              <Link
                key={item.path}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[#006241] font-medium text-white"
                    : "text-sidebar-muted hover:bg-white/10 hover:text-white"
                }`}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <Link
          href="/account"
          onClick={() => setOpen(false)}
          className="mb-4 block rounded-md px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white">
          Your account
        </Link>

        <div className="mb-5 border-t border-white/10 pt-5">
          <ThemeSwitcher />
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="
  w-full rounded-md border border-white/20
  px-3 py-2 text-left text-sm
  text-sidebar-foreground
  transition-colors hover:bg-white/10
">
            Log out
          </button>
        </form>
      </aside>
    </>
  )
}
