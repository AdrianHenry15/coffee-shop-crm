"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"
import { sendWorkspaceInvitationEmail } from "@/app/lib/email/workspace-invitation"

type TeamCommand =
  | { operation: "invite"; email: string; role: string }
  | { operation: "revoke"; invitationId: string }
  | {
      operation: "update"
      memberId: string
      role: string
      status: string
    }
  | { operation: "remove"; memberId: string }

type TeamResult = {
  error?: string
  message?: string
  leaveWorkspace?: boolean
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function getTeamError(error: { code?: string; message?: string }): string {
  if (error.code === "42501") {
    return "Only active workspace owners can manage the team."
  }

  if (error.code === "P0002") {
    return "This member or invitation no longer exists. Refresh the page."
  }

  if (error.code === "P0001") {
    return "Check the workspace subscription and available member capacity."
  }

  if (error.code === "23503") {
    return "This membership has related records. Suspend access instead."
  }

  if (error.code === "23514") {
    switch (error.message) {
      case "The workspace must retain an active owner":
        return "Appoint another active owner before changing your access."
      case "This member must accept an invitation first":
        return "This person must accept an invitation before being managed."
      case "This person already has a workspace membership":
        return "This person already has a membership. Manage their existing access."
      case "Too many pending workspace invitations":
        return "There are too many pending invitations. Revoke unused invitations first."
    }
  }

  return "Unable to update the team. Refresh the page and try again."
}

export async function manageWorkspaceTeam(
  slug: string,
  command: TeamCommand,
): Promise<TeamResult> {
  if (!command || typeof command !== "object") {
    return { error: "Invalid team action." }
  }

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Sign in again before managing the team." }
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (membershipError || membership?.role !== "owner") {
    return { error: "Only active workspace owners can manage the team." }
  }

  let message: string
  let leaveWorkspace = false

  switch (command.operation) {
    case "invite": {
      if (
        typeof command.email !== "string" ||
        !["admin", "member"].includes(command.role)
      ) {
        return { error: "Enter an email and choose Admin or Member." }
      }

      const email = command.email.trim().toLowerCase()

      if (email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
        return { error: "Enter a valid email address." }
      }

      const { data, error } = await supabase.rpc(
        "create_organization_invitation",
        {
          p_organization_id: organization.id,
          p_email: email,
          p_role: command.role,
        },
      )

      if (error) return { error: getTeamError(error) }

      if (typeof data !== "string") {
        return { error: "Unable to confirm the invitation was created." }
      }

      const emailSubmitted = await sendWorkspaceInvitationEmail({
        invitationId: data,
        workspaceName: organization.name,
        email,
        role: command.role === "admin" ? "admin" : "member",
      })

      message = emailSubmitted
        ? "Invitation created and submitted for email delivery."
        : "Invitation created, but email delivery could not be confirmed. Ask this person to sign in with the invited email and open the workspace selector."
      break
    }

    case "revoke": {
      if (!isUuid(command.invitationId)) {
        return { error: "Invalid invitation." }
      }

      const { error } = await supabase.rpc("revoke_organization_invitation", {
        p_organization_id: organization.id,
        p_invitation_id: command.invitationId,
      })

      if (error) return { error: getTeamError(error) }

      message = "Invitation revoked."
      break
    }

    case "update": {
      if (
        !isUuid(command.memberId) ||
        !["owner", "admin", "member"].includes(command.role) ||
        !["active", "suspended"].includes(command.status)
      ) {
        return { error: "Invalid membership details." }
      }

      const { error } = await supabase.rpc("update_organization_member", {
        p_organization_id: organization.id,
        p_member_id: command.memberId,
        p_role: command.role,
        p_status: command.status,
      })

      if (error) return { error: getTeamError(error) }

      leaveWorkspace =
        command.memberId === membership.id && command.status === "suspended"

      message = "Member access updated."
      break
    }

    case "remove": {
      if (!isUuid(command.memberId)) {
        return { error: "Invalid membership." }
      }

      const { error } = await supabase.rpc("remove_organization_member", {
        p_organization_id: organization.id,
        p_member_id: command.memberId,
      })

      if (error) return { error: getTeamError(error) }

      leaveWorkspace = command.memberId === membership.id
      message = "Workspace membership removed."
      break
    }

    default:
      return { error: "Invalid team action." }
  }

  revalidatePath(`/org/${slug}`, "layout")
  revalidatePath("/dashboard")
  revalidatePath("/onboarding")

  return { message, leaveWorkspace }
}
