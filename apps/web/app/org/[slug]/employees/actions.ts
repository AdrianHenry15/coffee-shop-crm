"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"

type SaveResult = {
  error?: string
  saved?: boolean
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export async function saveEmployee(
  slug: string,
  employeeId: string | null,
  expectedUpdatedAt: string | null,
  formData: FormData,
): Promise<SaveResult> {
  if (employeeId !== null && !isUuid(employeeId)) {
    return { error: "Invalid employee." }
  }

  if (
    employeeId !== null &&
    (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt)))
  ) {
    return { error: "Reload the employee before saving." }
  }

  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const phone = String(formData.get("phone") ?? "").trim()
  const jobTitle = String(formData.get("jobTitle") ?? "").trim()
  const status = String(formData.get("status") ?? "")
  const membershipId = String(formData.get("membershipId") ?? "").trim()

  if (!name || name.length > 120) {
    return { error: "Enter an employee name up to 120 characters." }
  }

  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email))) {
    return { error: "Enter a valid email address." }
  }

  if (phone.length > 50 || jobTitle.length > 120) {
    return { error: "Phone or job title is too long." }
  }

  if (!["active", "inactive"].includes(status)) {
    return { error: "Choose Active or Inactive." }
  }

  if (membershipId && !isUuid(membershipId)) {
    return { error: "Choose a valid workspace account." }
  }

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Sign in again before managing employees." }
  }

  const { data: membership, error: accessError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (
    accessError ||
    !membership ||
    !["owner", "admin"].includes(membership.role)
  ) {
    return { error: "Only workspace owners and admins can manage employees." }
  }

  const values = {
    name,
    email: email || null,
    phone: phone || null,
    job_title: jobTitle || null,
    status,
    membership_id: membershipId || null,
  }

  const result = employeeId
    ? await supabase
        .from("employees")
        .update(values)
        .eq("organization_id", organization.id)
        .eq("id", employeeId)
        .eq("updated_at", expectedUpdatedAt!)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("employees")
        .insert({
          organization_id: organization.id,
          ...values,
        })
        .select("id")
        .single()

  if (result.error) {
    console.error("Unable to save employee:", result.error)

    if (result.error.code === "23505") {
      return {
        error: "That workspace account is already linked to another employee.",
      }
    }

    if (result.error.code === "23514" || result.error.code === "23503") {
      return {
        error:
          "Check the employee details. A new account link must be an active member of this workspace.",
      }
    }

    if (result.error.code === "42501") {
      return { error: "You no longer have permission to manage employees." }
    }

    return { error: "Unable to save the employee. Please try again." }
  }

  if (!result.data) {
    return {
      error:
        "This employee changed after you opened it, or your access changed. Reload before saving.",
    }
  }

  revalidatePath(`/org/${slug}/employees`)

  return { saved: true }
}
