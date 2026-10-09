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
    <div className="min-h-screen md:flex">
      <Sidebar currentSlug={slug} organizations={organizations} />

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  )
}
