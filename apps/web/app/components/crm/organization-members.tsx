"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { manageWorkspaceTeam } from "@/app/org/[slug]/settings/team-actions"

type Member = {
  id: string
  role: string
  status: string
  user_id: string
  name: string | null
}

type Props = {
  members: Member[]
  currentUserId: string
  slug?: string
  canManage?: boolean
}

export function OrganizationMembers({
  members,
  currentUserId,
  slug,
  canManage = false,
}: Props) {
  return (
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div className="space-y-2">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Team members
        </h2>

        <p className="text-sm text-muted">
          People associated with this organization and their access roles.
        </p>

        {canManage && (
          <p className="text-xs text-muted">
            Owners manage the team. Appoint another active owner before stepping
            down. Suspending a member removes workspace access.
          </p>
        )}
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted">No organization members found.</p>
      ) : (
        <div className="divide-y divide-border">
          {members.map((member) => (
            <MemberRow
              key={`${member.id}:${member.role}:${member.status}`}
              member={member}
              isSelf={member.user_id === currentUserId}
              slug={slug}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function MemberRow({
  member,
  isSelf,
  slug,
  canManage,
}: {
  member: Member
  isSelf: boolean
  slug?: string
  canManage: boolean
}) {
  const router = useRouter()
  const [role, setRole] = useState(member.role)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  type Command = Parameters<typeof manageWorkspaceTeam>[1]

  function run(command: Command) {
    if (!slug || pending) return

    const workspaceSlug = slug

    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const result = await manageWorkspaceTeam(workspaceSlug, command)

        if (result.error) {
          setError(result.error)
          return
        }

        setMessage(result.message ?? "Team updated.")

        if (result.leaveWorkspace) {
          router.push("/dashboard")
        }

        router.refresh()
      } catch {
        setError("Unable to update this member. Please try again.")
      }
    })
  }

  function saveRole() {
    if (role === member.role) return

    if (
      (role === "owner" || (isSelf && role !== "owner")) &&
      !window.confirm(
        role === "owner"
          ? "Grant this person owner access? Owners can manage team access and workspace settings."
          : "Step down as owner? You will lose owner-only controls.",
      )
    ) {
      return
    }

    run({
      operation: "update",
      memberId: member.id,
      role,
      status: member.status,
    })
  }

  function toggleStatus() {
    const nextStatus = member.status === "active" ? "suspended" : "active"

    if (
      !window.confirm(
        nextStatus === "suspended"
          ? "Suspend this member's workspace access?"
          : "Reactivate this member? An available seat is required.",
      )
    ) {
      return
    }

    run({
      operation: "update",
      memberId: member.id,
      role: member.role,
      status: nextStatus,
    })
  }

  function removeMember() {
    if (
      !window.confirm(
        "Remove this workspace membership? Their login account will remain, but they will need a new invitation to rejoin.",
      )
    ) {
      return
    }

    run({ operation: "remove", memberId: member.id })
  }

  const editable =
    canManage &&
    Boolean(slug) &&
    ["active", "suspended"].includes(member.status)

  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
            {(member.name?.trim() || "?").charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 space-y-1">
            <p className="wrap-break-word text-sm font-medium text-foreground">
              {member.name ?? "Unnamed member"}

              {isSelf && (
                <span className="ml-2 text-xs font-normal text-muted">
                  (You)
                </span>
              )}
            </p>

            <p className="text-xs capitalize text-muted">
              {member.status.replaceAll("_", " ")}
            </p>
          </div>
        </div>

        <span className="rounded-full border border-border bg-surface-secondary px-3 py-1 font-mono text-xs capitalize text-foreground">
          {member.role}
        </span>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={pending}
              className="rounded-lg border border-border bg-background px-3 py-2 text-foreground">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </label>

          <button
            type="button"
            disabled={pending || role === member.role}
            onClick={saveRole}
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50">
            Save role
          </button>

          {!isSelf && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={toggleStatus}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50">
                {member.status === "active" ? "Suspend" : "Reactivate"}
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={removeMember}
                className="rounded-lg border border-border px-3 py-2 text-sm text-red-600 disabled:opacity-50">
                Remove
              </button>
            </>
          )}

          {pending && (
            <span role="status" className="text-xs text-muted">
              Updating...
            </span>
          )}
        </div>
      )}

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
    </div>
  )
}
