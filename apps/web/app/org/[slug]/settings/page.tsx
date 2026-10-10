import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import { OrganizationSettings } from "@/app/components/crm/organization-settings"
import { OrganizationProfile } from "@/app/components/crm/organization-profile"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { slug } = await params
  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user?.id ?? "")
    .eq("status", "active")
    .maybeSingle()

  const canEdit = membership?.role === "owner"

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-gray-500">
          Manage preferences for {organization.name}.
        </p>
      </div>

      <OrganizationProfile
        slug={slug}
        profile={organization}
        canEdit={canEdit}
      />

      <OrganizationSettings slug={slug} timezone={organization.timezone} />
    </main>
  )
}
