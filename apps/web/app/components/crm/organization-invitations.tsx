"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { manageWorkspaceTeam } from "@/app/org/[slug]/settings/team-actions"

type Invitation = {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

export function OrganizationInvitations({
  slug,
  invitations,
}: {
  slug: string
  invitations: Invitation[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  type Command = Parameters<typeof manageWorkspaceTeam>[1]

  function run(command: Command) {
    if (pending) return

    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const result = await manageWorkspaceTeam(slug, command)

        if (result.error) {
          setError(result.error)
          return
        }

        if (command.operation === "invite") {
          setEmail("")
        }

        setMessage(result.message ?? "Invitations updated.")
        router.refresh()
      } catch {
        setError("Unable to update invitations. Please try again.")
      }
    })
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-surface p-6">
      <div className="space-y-2">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Invite a teammate
        </h2>

        <p className="text-sm text-muted">
          Invitations expire after 7 days. Available member capacity is checked
          when the person accepts.
        </p>

        <p className="text-sm text-muted">
          Email notifications are not enabled yet. Ask the recipient to sign in
          with the invited email and open the workspace selector.
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          run({ operation: "invite", email, role })
        }}>
        <label className="block space-y-1 text-sm text-foreground">
          <span>Email address</span>
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="block space-y-1 text-sm text-foreground">
          <span>Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={pending}
            className="w-full rounded-lg border border-border bg-background px-3 py-2">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Updating..." : "Create invitation"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">
          Recent invitations
        </h3>

        {invitations.length === 0 ? (
          <p className="text-sm text-muted">No invitations yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="wrap-break-word text-sm font-medium text-foreground">
                    {invitation.email}
                  </p>
                  <p className="text-xs capitalize text-muted">
                    {invitation.role} · {invitation.status}
                  </p>
                </div>

                {invitation.status === "pending" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm("Revoke this invitation?")) {
                        run({
                          operation: "revoke",
                          invitationId: invitation.id,
                        })
                      }
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50">
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
