import { Sidebar } from "@/app/components/crm/sidebar"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // RLS verifies access to this organization.
  await getOrganization(slug)

  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    throw new Error("Authentication required.")
  }

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organizations(id, name, slug)")
    .eq("user_id", userData.user.id)
    .eq("status", "active")

  if (error) {
    throw new Error("Unable to load workspaces.")
  }

  const organizations = (memberships ?? []).flatMap((membership) =>
    membership.organizations ? [membership.organizations] : [],
  )

  return (
    <div className="min-h-screen bg-background md:flex">
      <Sidebar currentSlug={slug} organizations={organizations} />

      <main className="min-w-0 flex-1 bg-background px-4 py-6 md:px-8 md:py-8 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
