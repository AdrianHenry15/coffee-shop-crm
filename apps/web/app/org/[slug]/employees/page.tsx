import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"
import { EmployeeDirectory } from "@/app/components/crm/employee-directory"

const PAGE_SIZE = 25

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { slug } = await params
  const query = await searchParams

  const rawPage = typeof query.page === "string" ? query.page : "1"
  const parsedPage = Number(rawPage)
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 1000000)
      : 1

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (membershipError) {
    throw new Error("Unable to verify employee-directory access.")
  }

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    redirect(`/org/${slug}/dashboard`)
  }

  const {
    data: employees,
    count,
    error: employeesError,
  } = await supabase
    .from("employees")
    .select(
      "id, name, email, phone, job_title, status, membership_id, updated_at",
      { count: "exact" },
    )
    .eq("organization_id", organization.id)
    .order("name")
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (employeesError) {
    throw new Error("Unable to load employees.")
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (page > totalPages) {
    redirect(`/org/${slug}/employees?page=${totalPages}`)
  }

  const { data: members, error: membersError } = await supabase
    .from("organization_members")
    .select("id, user_id, role, status")
    .eq("organization_id", organization.id)
    .in("status", ["active", "suspended"])
    .order("created_at")
    .order("id")

  if (membersError) {
    throw new Error("Unable to load workspace accounts.")
  }

  const userIds = [...new Set((members ?? []).map((member) => member.user_id))]

  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds)
    : { data: [], error: null }

  if (profilesError) {
    throw new Error("Unable to load workspace account names.")
  }

  const accounts = (members ?? []).map((member) => {
    const profile = profiles?.find((entry) => entry.id === member.user_id)

    const name = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")

    return {
      id: member.id,
      label: `${name || `Account ${member.user_id.slice(0, 8)}`} · ${member.role}`,
      status: member.status,
    }
  })

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          People
        </p>

        <h1 className="font-mono text-3xl font-semibold text-foreground">
          Employees
        </h1>

        <p className="text-sm text-muted">
          Manage staff records for {organization.name}. No account or invitation
          is required to add an employee.
        </p>
      </header>

      <EmployeeDirectory
        slug={slug}
        employees={employees ?? []}
        accounts={accounts}
      />

      <nav
        aria-label="Employee pages"
        className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <p className="text-muted">
          {total} employee records · Page {page} of {totalPages}
        </p>

        <div className="flex gap-4">
          {page > 1 && (
            <Link
              href={`/org/${slug}/employees?page=${page - 1}`}
              className="text-primary hover:underline">
              Previous
            </Link>
          )}

          {page < totalPages && (
            <Link
              href={`/org/${slug}/employees?page=${page + 1}`}
              className="text-primary hover:underline">
              Next
            </Link>
          )}
        </div>
      </nav>
    </div>
  )
}
