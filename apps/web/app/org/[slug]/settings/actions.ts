"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"

const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
]

export async function updateOrganizationTimezone(
  slug: string,
  timezone: string,
) {
  if (!timezones.includes(timezone)) {
    throw new Error("Invalid timezone")
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("Unauthorized")
  }

  const organization = await getOrganization(slug)

  // Only the organization owner can change settings.
  const { data: membership, error: memberError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .single()

  if (memberError || membership?.role !== "owner") {
    throw new Error("Only the organization owner can change settings")
  }

  const { error } = await supabase
    .from("organizations")
    .update({ timezone })
    .eq("id", organization.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/org/${slug}`, "layout")
}
