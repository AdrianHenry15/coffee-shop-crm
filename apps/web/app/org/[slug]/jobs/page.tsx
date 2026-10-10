import Link from "next/link"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"
import { JobForm } from "@/app/components/crm/job-form"

type Props = {
  params: Promise<{ slug: string }>
}

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  canceled: "Canceled",
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
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="text-sm text-gray-500">
          Manage customer work and scheduling.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Scheduled", value: counts.scheduled },
          { label: "In Progress", value: counts.inProgress },
          { label: "Completed", value: counts.completed },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border p-5">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">All Jobs</h2>

        {jobs.length === 0 ? (
          <p className="rounded-lg border p-5 text-sm text-gray-500">
            No jobs yet. Create your first job below.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <Link
                    href={`/org/${slug}/jobs/${job.id}`}
                    className="font-medium hover:underline">
                    {job.title}
                  </Link>

                  <p className="text-sm text-gray-500">
                    {customerNames.get(job.customer_id) ?? "Unknown Customer"}
                  </p>

                  {job.scheduled_start && (
                    <p className="text-sm text-gray-500">
                      {new Date(job.scheduled_start).toLocaleString()}
                    </p>
                  )}
                </div>

                <span className="rounded-full border px-3 py-1 text-sm">
                  {statusLabels[job.status] ?? job.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <JobForm slug={slug} customers={customers} estimates={estimates} />

      <Link
        href={`/org/${slug}/customers`}
        className="inline-block text-sm underline">
        View Customers
      </Link>
    </div>
  )
}
