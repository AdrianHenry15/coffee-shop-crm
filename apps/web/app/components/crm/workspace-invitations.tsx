"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { acceptWorkspaceInvitation } from "@/app/invitations/actions"

type Invitation = {
  id: string
  organization_name: string
  organization_slug: string
  role: string
  expires_at: string
}

export function WorkspaceInvitations({
  invitations,
}: {
  invitations: Invitation[]
}) {
  if (invitations.length === 0) return null

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <div className="space-y-1">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Workspace invitations
        </h2>

        <p className="text-sm text-muted">
          You have been invited to join the following workspaces.
        </p>
      </div>

      <div className="divide-y divide-border">
        {invitations.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} />
        ))}
      </div>
    </section>
  )
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAccept() {
    if (pending) return

    setError(null)

    startTransition(async () => {
      try {
        const result = await acceptWorkspaceInvitation(invitation.id)

        if (result.error) {
          setError(result.error)
          return
        }

        if (!result.workspaceSlug) {
          setError("Unable to open the workspace. Please reload the page.")
          return
        }

        router.push(
          `/org/${encodeURIComponent(result.workspaceSlug)}/dashboard`,
        )
        router.refresh()
      } catch {
        setError("Unable to accept the invitation. Please try again.")
      }
    })
  }

  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="wrap-break-word font-medium text-foreground">
            {invitation.organization_name}
          </p>

          <p className="text-sm text-muted">
            Join as <span className="capitalize">{invitation.role}</span>
          </p>

          <p className="text-xs text-muted">
            Expires{" "}
            <time dateTime={invitation.expires_at}>
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(new Date(invitation.expires_at))}{" "}
              (UTC)
            </time>
          </p>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handleAccept}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Joining..." : "Accept invitation"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
