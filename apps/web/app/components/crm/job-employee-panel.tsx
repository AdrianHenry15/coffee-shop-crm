import { createClient } from "@/app/lib/supabase/server"
import { JobEmployeeAssignments } from "./job-employee-assignments"

export async function JobEmployeePanel({
  slug,
  organizationId,
  jobId,
}: {
  slug: string
  organizationId: string
  jobId: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (membershipError) {
    throw new Error("Unable to verify assignment access.")
  }

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return null
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("job_employee_assignments")
    .select("employee_id, employees(id, name, status)")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .order("employee_id")

  if (assignmentsError) {
    throw new Error("Unable to load assigned employees.")
  }

  const assigned = (assignments ?? [])
    .flatMap((assignment) =>
      assignment.employees ? [assignment.employees] : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const assignedIds = new Set(
    (assignments ?? []).map((assignment) => assignment.employee_id),
  )

  // Fetch in pages so larger directories are not silently truncated.
  const activeEmployees: {
    id: string
    name: string
    status: string
  }[] = []

  const batchSize = 500

  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, status")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("name")
      .order("id")
      .range(offset, offset + batchSize - 1)

    if (error) {
      throw new Error("Unable to load available employees.")
    }

    activeEmployees.push(...(data ?? []))

    if (!data?.length) break
  }

  return (
    <JobEmployeeAssignments
      slug={slug}
      jobId={jobId}
      assigned={assigned}
      available={activeEmployees.filter(
        (employee) => !assignedIds.has(employee.id),
      )}
    />
  )
}
