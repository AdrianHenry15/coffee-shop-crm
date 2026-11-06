"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"

type AcceptInvitationResult = {
  error?: string
  workspaceSlug?: string
}

export async function acceptWorkspaceInvitation(
  invitationId: string,
): Promise<AcceptInvitationResult> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      invitationId,
    )
  ) {
    return { error: "Invalid invitation." }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Sign in again before accepting this invitation." }
  }

  const { data: accepted, error: acceptanceError } = await supabase.rpc(
    "has_current_legal_acceptance",
  )

  if (acceptanceError) {
    return {
      error: "Unable to verify legal acceptance. Please try again.",
    }
  }

  if (accepted !== true) {
    return {
      error:
        "Open the dashboard to review and accept the Terms and Privacy Notice before accepting this invitation.",
    }
  }

  const { data: organizationId, error } = await supabase.rpc(
    "accept_organization_invitation",
    { p_invitation_id: invitationId },
  )

  if (error || typeof organizationId !== "string") {
    console.error("Unable to accept workspace invitation:", error)

    if (error?.code === "P0001") {
      return {
        error:
          "This workspace cannot add an active member right now. Ask its owner to check the plan capacity and subscription status.",
      }
    }

    if (error?.code === "42501") {
      return {
        error:
          "Sign in with the invitation's email address and confirm that email before accepting.",
      }
    }

    if (error?.code === "23514") {
      return {
        error:
          "This invitation is no longer available, or your account already has a membership. Ask the workspace owner to check your access.",
      }
    }

    return { error: "Unable to accept the invitation. Please try again." }
  }

  revalidatePath("/dashboard")
  revalidatePath("/onboarding")

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .single()

  if (organizationError || !organization) {
    return {
      error:
        "Your membership was accepted, but the workspace could not be opened. Reload the dashboard.",
    }
  }

  revalidatePath(`/org/${organization.slug}/settings`)

  return { workspaceSlug: organization.slug }
}
