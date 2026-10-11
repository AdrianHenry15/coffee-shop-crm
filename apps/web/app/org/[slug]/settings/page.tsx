import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import { OrganizationSettings } from "@/app/components/crm/organization-settings"
import { OrganizationProfile } from "@/app/components/crm/organization-profile"
import { OrganizationMembers } from "@/app/components/crm/organization-members"
import { OrganizationSubscription } from "@/app/components/crm/organization-subscription"
import { OrganizationPlans } from "@/app/components/crm/organization-plans"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { slug } = await params
  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const { data: subscriptionUsage, error: subscriptionError } =
    await supabase.rpc("get_organization_subscription_usage", {
      org_uuid: organization.id,
    })

  if (subscriptionError) {
    throw new Error("Unable to load subscription usage")
  }

  const { data: billingPlans, error: plansError } = await supabase
    .from("billing_plans")
    .select("*")

  if (plansError) {
    throw new Error("Unable to load billing plans")
  }

  const planOrder = ["free", "starter", "pro"]

  const sortedPlans = (billingPlans ?? []).sort(
    (a, b) => planOrder.indexOf(a.id) - planOrder.indexOf(b.id),
  )

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
    .select("id, user_id, role, status")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: true })

  if (membersError) {
    console.error("Organization members query failed:", membersError)
    throw new Error(membersError.message)
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
    <main className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Workspace management
        </p>

        <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
          Organization settings
        </h1>

        <p className="mt-2 text-sm text-muted">
          Manage your organization, team, and subscription for{" "}
          {organization.name}.
        </p>
      </header>

      <div className="space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Organization
            </h2>

            <p className="mt-1 text-sm text-muted">
              Manage your business profile and workspace preferences.
            </p>
          </div>

          <div className="space-y-5">
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
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-8">
          <div>
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Subscription & billing
            </h2>

            <p className="mt-1 text-sm text-muted">
              Review your current plan, usage, and available upgrades.
            </p>
          </div>

          <div className="space-y-5">
            <OrganizationSubscription usage={subscriptionUsage ?? []} />

            {subscriptionUsage?.[0] && (
              <OrganizationPlans
                plans={sortedPlans}
                currentPlanId={subscriptionUsage[0].plan_id}
              />
            )}
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-8">
          <div>
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Team members
            </h2>

            <p className="mt-1 text-sm text-muted">
              View and manage the people who have access to your organization.
            </p>
          </div>

          <OrganizationMembers
            members={membersWithProfiles}
            currentUserId={user.id}
          />
        </section>
      </div>
    </main>
  )
}
