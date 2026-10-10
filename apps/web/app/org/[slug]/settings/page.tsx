import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import { OrganizationSettings } from "@/app/components/crm/organization-settings"
import { OrganizationProfile } from "@/app/components/crm/organization-profile"
import { OrganizationMembers } from "@/app/components/crm/organization-members"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { slug } = await params
  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("Authentication required")
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  const { data: members, error: membersError } = await supabase
    .from("organization_members")
    .select(
      `
  id,
  user_id,
  role,
  status,
  profiles (
    first_name,
    last_name,
    avatar_url
  )
`,
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: true })

  if (membersError) {
    throw new Error("Unable to load organization members")
  }

  const memberIds = (members ?? []).map((member) => member.user_id)

  const { data: profiles, error: profilesError } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", memberIds)
    : { data: [], error: null }

  if (profilesError) {
    throw new Error("Unable to load member profiles")
  }

  const membersWithProfiles = (members ?? []).map((member) => {
    const profile = profiles?.find((profile) => profile.id === member.user_id)

    return {
      ...member,
      name:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        null,
    }
  })

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

      <OrganizationSettings
        canEdit={canEdit}
        slug={slug}
        timezone={organization.timezone}
      />

      <OrganizationMembers
        members={membersWithProfiles}
        currentUserId={user.id}
      />
    </main>
  )
}
