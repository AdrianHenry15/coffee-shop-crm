import Link from "next/link"
import { redirect } from "next/navigation"
import { logout } from "@/app/auth/actions"
import { createClient } from "@/app/lib/supabase/server"
import { WorkspaceInvitations } from "@/app/components/crm/workspace-invitations"

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

  const { data: invitations, error: invitationsError } = await supabase.rpc(
    "list_my_organization_invitations",
  )

  if (invitationsError) {
    throw new Error("Unable to load workspace invitations.")
  }

  const pendingInvitations = invitations ?? []

  const organizations = (memberships ?? []).flatMap((membership) =>
    membership.organizations ? [membership.organizations] : [],
  )

  if (pendingInvitations.length === 0) {
    if (organizations.length === 0) {
      redirect("/onboarding")
    }

    if (organizations.length === 1) {
      redirect(`/org/${organizations[0].slug}/dashboard`)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-mono text-3xl font-semibold text-foreground">
            Your workspaces
          </h1>

          <p className="text-sm text-muted">
            Open a workspace or accept an invitation to join a team.
          </p>
        </header>

        <WorkspaceInvitations invitations={pendingInvitations} />

        {organizations.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Select a workspace
            </h2>

            {organizations.map((organization) => (
              <Link
                key={organization.id}
                href={`/org/${organization.slug}/dashboard`}
                className="block rounded-xl border border-border bg-surface p-4 text-foreground hover:bg-surface-secondary">
                {organization.name}
              </Link>
            ))}
          </section>
        ) : (
          <Link
            href="/onboarding"
            className="inline-flex text-sm font-medium text-primary hover:underline">
            Or create your own workspace
          </Link>
        )}

        <div className="flex items-center justify-between gap-4">
          <Link
            href="/account"
            className="text-sm font-medium text-primary hover:underline">
            Your account
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-muted hover:text-primary hover:underline">
              Log out
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
