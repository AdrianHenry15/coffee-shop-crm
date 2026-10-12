import Link from "next/link"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"
import { JobForm } from "@/app/components/crm/forms/job-form"
import { formatOrganizationDateTime } from "@/app/lib/dates"
import { Suspense } from "react"
import { RedirectToast } from "@/app/components/crm/ui/redirect-toast"

type Props = {
  params: Promise<{ slug: string }>
}

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  canceled: "Canceled",
}

const jobMessages = {
  created: "Job created successfully.",
  deleted: "Job deleted successfully.",
}
export default async function JobsPage({ params }: Props) {
  const { slug } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const [customersResult, estimatesResult, jobsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("organization_id", organization.id)
      .order("name"),

    supabase
      .from("estimates")
      .select("id, customer_id")
      .eq("organization_id", organization.id)
      .eq("status", "accepted"),

    supabase
      .from("jobs")
      .select(
        `
          id,
          customer_id,
          estimate_id,
          title,
          status,
          scheduled_start,
          created_at
        `,
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
  ])

  if (customersResult.error) {
    throw new Error(customersResult.error.message)
  }

  if (estimatesResult.error) {
    throw new Error(estimatesResult.error.message)
  }

  if (jobsResult.error) {
    throw new Error(jobsResult.error.message)
  }

  const customers = customersResult.data ?? []

  const usedEstimateIds = new Set(
    (jobsResult.data ?? [])
      .map((job) => job.estimate_id)
      .filter((id): id is string => id !== null),
  )

  const estimates = (estimatesResult.data ?? []).filter(
    (estimate) => !usedEstimateIds.has(estimate.id),
  )

  const jobs = jobsResult.data ?? []

  const customerNames = new Map(
    customers.map((customer) => [customer.id, customer.name]),
  )

  const counts = {
    scheduled: jobs.filter((job) => job.status === "scheduled").length,
    inProgress: jobs.filter((job) => job.status === "in_progress").length,
    completed: jobs.filter((job) => job.status === "completed").length,
  }

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <RedirectToast messages={jobMessages} />
      </Suspense>

      <header>
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Operations management
        </p>

        <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
          Jobs
        </h1>

        <p className="mt-2 text-sm text-muted">
          Manage customer work and scheduling for {organization.name}.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Scheduled", value: counts.scheduled },
          { label: "In progress", value: counts.inProgress },
          { label: "Completed", value: counts.completed },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-surface p-5">
            <p className="font-mono text-xs font-medium uppercase tracking-wide text-muted">
              {stat.label}
            </p>

            <p className="mt-3 font-mono text-3xl font-semibold text-foreground">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-lg font-semibold text-foreground">
              All jobs
            </h2>

            <p className="mt-1 text-sm text-muted">
              Track scheduled, active, and completed work.
            </p>
          </div>

          <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs font-medium text-foreground">
            {jobs.length} total
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-mono text-sm font-medium text-foreground">
              No jobs yet
            </p>

            <p className="mt-2 text-sm text-muted">
              Create your first job using the form below.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0 space-y-2">
                  <Link
                    href={`/org/${slug}/jobs/${job.id}`}
                    className="font-medium text-foreground transition-colors hover:text-primary hover:underline">
                    {job.title}
                  </Link>

                  <p className="text-sm text-muted">
                    {customerNames.get(job.customer_id) ?? "Unknown customer"}
                  </p>

                  {job.scheduled_start && (
                    <p className="font-mono text-xs text-muted">
                      {formatOrganizationDateTime(
                        job.scheduled_start,
                        organization.timezone,
                      )}
                    </p>
                  )}
                </div>

                <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium text-primary">
                  {statusLabels[job.status] ?? job.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Create job
          </h2>

          <p className="mt-1 text-sm text-muted">
            Schedule new work for a customer or an accepted estimate.
          </p>
        </div>

        <JobForm
          slug={slug}
          timezone={organization.timezone}
          customers={customers}
          estimates={estimates}
        />
      </section>

      <div className="flex justify-end">
        <Link
          href={`/org/${slug}/customers`}
          className="text-sm font-medium text-primary hover:underline">
          View customers →
        </Link>
      </div>
    </div>
  )
}
