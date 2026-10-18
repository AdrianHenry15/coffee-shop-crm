import "server-only"

import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"

export async function getCatalogAccess(slug: string) {
  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("Authentication required.")
  }

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (error || !membership) {
    throw new Error("Unable to verify workspace access.")
  }

  return {
    organization,
    supabase,
    canManage: ["owner", "admin"].includes(membership.role),
  }
}
