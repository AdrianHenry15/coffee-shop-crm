"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"

type AssignmentResult = {
  error?: string
  success?: boolean
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

export async function changeJobEmployeeAssignment(
  slug: string,
  jobId: string,
  employeeId: string,
  operation: "assign" | "unassign",
): Promise<AssignmentResult> {
  if (
    !isUuid(jobId) ||
    !isUuid(employeeId) ||
    !["assign", "unassign"].includes(operation)
  ) {
    return { error: "Invalid assignment request." }
  }

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Sign in again before managing assignments." }
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (
    membershipError ||
    !membership ||
    !["owner", "admin"].includes(membership.role)
  ) {
    return {
      error: "Only workspace owners and admins can manage assignments.",
    }
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("id", jobId)
    .maybeSingle()

  if (jobError || !job) {
    return { error: "This job is unavailable. Refresh the page." }
  }

  const { error } =
    operation === "assign"
      ? await supabase.from("job_employee_assignments").insert({
          organization_id: organization.id,
          job_id: jobId,
          employee_id: employeeId,
        })
      : await supabase
          .from("job_employee_assignments")
          .delete()
          .eq("organization_id", organization.id)
          .eq("job_id", jobId)
          .eq("employee_id", employeeId)

  // Repeating an assignment that already exists is harmless.
  if (error && !(operation === "assign" && error.code === "23505")) {
    console.error("Unable to update job assignment:", error)

    if (error.code === "23514") {
      return {
        error: "Choose an active employee from this workspace.",
      }
    }

    if (error.code === "23503") {
      return {
        error: "The job or employee is no longer available. Refresh the page.",
      }
    }

    return { error: "Unable to update the assignment. Please try again." }
  }

  revalidatePath(`/org/${slug}/jobs/${jobId}`)
  revalidatePath(`/org/${slug}/jobs`)
  revalidatePath(`/org/${slug}/schedule`)

  return { success: true }
}
