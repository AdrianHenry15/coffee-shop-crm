import Link from "next/link"
import { redirect } from "next/navigation"
import { logout } from "@/app/auth/actions"
import { createClient } from "../lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    redirect("/login")
  }

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(id, name, slug)")
    .eq("user_id", userData.user.id)
    .eq("status", "active")

  if (error) {
    throw new Error("Unable to load workspaces.")
  }

  if (!memberships?.length) {
    redirect("/onboarding")
  }

  const organizations = memberships.flatMap((membership) =>
    membership.organizations ? [membership.organizations] : [],
  )

  if (organizations.length === 1) {
    redirect(`/org/${organizations[0].slug}/dashboard`)
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-3xl font-semibold">Select a workspace</h1>

      <div className="mt-6 space-y-3">
        {organizations.map((organization) => (
          <Link
            key={organization.id}
            href={`/org/${organization.slug}/dashboard`}
            className="block rounded-md border p-4 hover:bg-gray-50">
            {organization.name}
          </Link>
        ))}
      </div>

      <form action={logout} className="mt-8">
        <button type="submit" className="underline">
          Log out
        </button>
      </form>
    </main>
  )
}
