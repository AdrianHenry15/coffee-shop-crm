"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"

export async function grantPartner(organizationId: string) {
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    return { error: "Authentication required." }
  }

  const { error } = await supabase.rpc("grant_organization_partner", {
    org_uuid: organizationId,
  })

  if (error) {
    return { error: "Unable to grant Partner benefits." }
  }

  revalidatePath(`/admin/organizations/${organizationId}`)
  revalidatePath("/admin/organizations")

  return { success: true }
}

export async function updateMaintenance(
  organizationId: string,
  startDate: string | null,
  endDate: string | null,
) {
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    return { error: "Authentication required." }
  }

  if ((startDate === null) !== (endDate === null)) {
    return { error: "Both maintenance dates are required." }
  }

  if (startDate !== null && endDate !== null) {
    const start = Date.parse(`${startDate}T00:00:00Z`)
    const end = Date.parse(`${endDate}T00:00:00Z`)

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return { error: "End date must be after start date." }
    }
  }

  const args = {
    org_uuid: organizationId,
    starts_at: startDate ? `${startDate}T00:00:00Z` : null,
    ends_at: endDate ? `${endDate}T00:00:00Z` : null,
  }

  const { error } = await supabase.rpc(
    "set_organization_maintenance",
    args as {
      org_uuid: string
      starts_at: string
      ends_at: string
    },
  )

  if (error) {
    return { error: "Unable to update maintenance agreement." }
  }

  revalidatePath(`/admin/organizations/${organizationId}`)
  revalidatePath("/admin/organizations")

  return { success: true }
}

export async function revokePartner(organizationId: string) {
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    return { error: "Authentication required." }
  }

  const { error } = await supabase.rpc("revoke_organization_partner", {
    org_uuid: organizationId,
  })

  if (error) {
    return { error: "Unable to revoke Partner benefits." }
  }

  revalidatePath(`/admin/organizations/${organizationId}`)
  revalidatePath("/admin/organizations")

  return { success: true }
}
