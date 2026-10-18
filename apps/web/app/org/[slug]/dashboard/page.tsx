import Link from "next/link"
import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import { PipelineOverview } from "@/app/components/crm/pipeline-overview"
import { Activity, RecentActivity } from "@/app/components/crm/recent-activity"
import { FirstRunTour } from "@/app/components/crm/first-run-tour"

export default async function OrganizationDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tour?: string }>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const now = new Date()
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const [
    leadsResult,
    customersResult,
    estimatesResult,
    jobsResult,
    upcomingResult,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),

    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),

    supabase
      .from("estimates")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .in("status", ["draft", "sent"]),

    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .in("status", ["scheduled", "in_progress"]),

    supabase
      .from("jobs")
      .select("id, title, customer_id, status, scheduled_start")
      .eq("organization_id", organization.id)
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_start", now.toISOString())
      .lt("scheduled_start", nextWeek.toISOString())
      .order("scheduled_start")
      .limit(5),
  ])

  const results = [
    leadsResult,
    customersResult,
    estimatesResult,
    jobsResult,
    upcomingResult,
  ]

  for (const result of results) {
    if (result.error) {
      throw new Error(result.error.message)
    }
  }

  const upcomingJobs = upcomingResult.data ?? []

  const customerIds = [...new Set(upcomingJobs.map((job) => job.customer_id))]

  const { data: customers, error: customerError } =
    customerIds.length > 0
      ? await supabase
          .from("customers")
          .select("id, name")
          .eq("organization_id", organization.id)
          .in("id", customerIds)
      : { data: [], error: null }

  if (customerError) {
    throw new Error(customerError.message)
  }

  const [leadStatuses, estimateStatuses, jobStatuses] = await Promise.all([
    supabase
      .from("leads")
      .select("status")
      .eq("organization_id", organization.id),

    supabase
      .from("estimates")
      .select("status")
      .eq("organization_id", organization.id),

    supabase
      .from("jobs")
      .select("status")
      .eq("organization_id", organization.id),
  ])

  for (const result of [leadStatuses, estimateStatuses, jobStatuses]) {
    if (result.error) {
      throw new Error(result.error.message)
    }
  }

  function countStatuses(
    rows: { status: string }[],
    statuses: { label: string; value: string }[],
  ) {
    return statuses.map(({ label, value }) => ({
      label,
      count: rows.filter((row) => row.status === value).length,
    }))
  }

  const pipeline = {
    leads: countStatuses(leadStatuses.data ?? [], [
      { label: "New", value: "new" },
      { label: "Contacted", value: "contacted" },
      { label: "Qualified", value: "qualified" },
      { label: "Lost", value: "lost" },
    ]),

    estimates: countStatuses(estimateStatuses.data ?? [], [
      { label: "Draft", value: "draft" },
      { label: "Sent", value: "sent" },
      { label: "Accepted", value: "accepted" },
      { label: "Declined", value: "declined" },
    ]),

    jobs: countStatuses(jobStatuses.data ?? [], [
      { label: "Scheduled", value: "scheduled" },
      { label: "In Progress", value: "in_progress" },
      { label: "Completed", value: "completed" },
      { label: "Canceled", value: "canceled" },
    ]),
  }

  const [
    recentLeads,
    recentCustomers,
    recentEstimates,
    recentJobs,
    recentCustomerActivities,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8),

    supabase
      .from("customers")
      .select("id, name, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8),

    supabase
      .from("estimates")
      .select("id, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8),

    supabase
      .from("jobs")
      .select("id, title, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8),

    supabase
      .from("customer_activities")
      .select("id, customer_id, type, content, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  for (const result of [
    recentLeads,
    recentCustomers,
    recentEstimates,
    recentJobs,
    recentCustomerActivities,
  ]) {
    if (result.error) {
      throw new Error(result.error.message)
    }
  }

  const activities: Activity[] = [
    ...(recentLeads.data ?? []).map((lead) => ({
      id: lead.id,
      type: "lead" as const,
      title: "New Lead",
      description: lead.name,
      createdAt: lead.created_at,
      href: `/org/${slug}/leads`,
    })),

    ...(recentCustomers.data ?? []).map((customer) => ({
      id: customer.id,
      type: "customer" as const,
      title: "Customer Added",
      description: customer.name,
      createdAt: customer.created_at,
      href: `/org/${slug}/customers`,
    })),

    ...(recentEstimates.data ?? []).map((estimate) => ({
      id: estimate.id,
      type: "estimate" as const,
      title: "Estimate Created",
      description: `Estimate #${estimate.id.slice(0, 8)}`,
      createdAt: estimate.created_at,
      href: `/org/${slug}/estimates/${estimate.id}`,
    })),

    ...(recentJobs.data ?? []).map((job) => ({
      id: job.id,
      type: "job" as const,
      title: "Job Created",
      description: job.title,
      createdAt: job.created_at,
      href: `/org/${slug}/jobs/${job.id}`,
    })),

    ...(recentCustomerActivities.data ?? []).map((activity) => ({
      id: activity.id,
      type: "activity" as const,
      title:
        activity.type === "call"
          ? "Customer Called"
          : activity.type === "email"
            ? "Email Logged"
            : "Customer Note",
      description: activity.content,
      createdAt: activity.created_at,
      href: `/org/${slug}/customers/${activity.customer_id}`,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8)

  const customerNames = new Map(
    (customers ?? []).map((customer) => [customer.id, customer.name]),
  )

  const stats = [
    {
      label: "Leads",
      value: leadsResult.count ?? 0,
      href: "leads",
    },
    {
      label: "Customers",
      value: customersResult.count ?? 0,
      href: "customers",
    },
    {
      label: "Open Estimates",
      value: estimatesResult.count ?? 0,
      href: "estimates",
    },
    {
      label: "Active Jobs",
      value: jobsResult.count ?? 0,
      href: "jobs",
    },
  ]

  return (
    <div className="space-y-8">
      <FirstRunTour slug={slug} startOpen={query.tour === "welcome"} />
      {/* Dashboard Header */}
      <header>
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Workspace / Overview
        </p>

        <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>

        <p className="mt-2 text-sm text-muted">
          Overview of {organization.name}
        </p>
      </header>

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={`/org/${slug}/${stat.href}`}
            className="
            group rounded-xl border border-border
            bg-surface p-5 transition-all
            hover:-translate-y-0.5
            hover:border-primary/40
            hover:shadow-sm
          ">
            <p className="text-sm text-muted">{stat.label}</p>

            <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-primary">
              {stat.value}
            </p>

            <p className="mt-3 text-xs text-muted transition-colors group-hover:text-primary">
              View details →
            </p>
          </Link>
        ))}
      </div>

      {/* Pipeline */}
      <PipelineOverview
        leads={pipeline.leads}
        estimates={pipeline.estimates}
        jobs={pipeline.jobs}
      />

      {/* Upcoming Jobs */}
      <section className="rounded-xl border border-border bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-base font-semibold text-foreground">
              Upcoming Jobs
            </h2>
            <p className="mt-1 text-sm text-muted">
              Scheduled for the next seven days
            </p>
          </div>

          <Link
            href={`/org/${slug}/schedule`}
            className="text-sm font-medium text-primary hover:underline">
            View Schedule →
          </Link>
        </div>

        {upcomingJobs.length === 0 ? (
          <div className="mt-5 rounded-lg bg-surface-secondary p-5">
            <p className="text-sm text-muted">
              No upcoming jobs in the next 7 days.
            </p>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-border">
            {upcomingJobs.map((job) => (
              <Link
                key={job.id}
                href={`/org/${slug}/jobs/${job.id}`}
                className="
                flex flex-wrap items-center
                justify-between gap-4
                rounded-md px-2 py-4
                transition-colors
                hover:bg-surface-secondary
              ">
                <div>
                  <p className="font-medium text-foreground">{job.title}</p>

                  <p className="mt-1 text-sm text-muted">
                    {customerNames.get(job.customer_id) ?? "Unknown Customer"}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-sm text-foreground">
                    {job.scheduled_start
                      ? new Date(job.scheduled_start).toLocaleString()
                      : "Unscheduled"}
                  </p>

                  <p className="mt-1 font-mono text-xs text-primary">
                    {job.status === "in_progress" ? "In Progress" : "Scheduled"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <RecentActivity activities={activities} />

      {/* Quick Actions */}
      <section className="rounded-xl border border-border bg-surface p-5 md:p-6">
        <div>
          <h2 className="font-mono text-base font-semibold text-foreground">
            Quick Actions
          </h2>

          <p className="mt-1 text-sm text-muted">
            Jump back into your workflow
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Manage Leads", path: "leads" },
            { label: "Manage Customers", path: "customers" },
            { label: "Create Estimate", path: "estimates" },
            { label: "Create Job", path: "jobs" },
          ].map((action) => (
            <Link
              key={action.path}
              href={`/org/${slug}/${action.path}`}
              className="
              rounded-lg border border-border
              bg-surface-secondary px-4 py-3
              text-center text-sm font-medium
              text-foreground transition-colors
              hover:border-primary/40
              hover:bg-primary hover:text-primary-foreground
            ">
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
