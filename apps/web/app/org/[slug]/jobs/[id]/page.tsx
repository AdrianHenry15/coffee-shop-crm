import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"
import { JobManager } from "@/app/components/crm/managers/job-manager"
import { formatOrganizationDateTime } from "@/app/lib/dates"

type Props = {
  params: Promise<{
    slug: string
    id: string
  }>
}

type JobStatus = "scheduled" | "in_progress" | "completed" | "canceled"

export default async function JobDetailsPage({ params }: Props) {
  const { slug, id } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      `
      id,
      customer_id,
      estimate_id,
      title,
      description,
      status,
      scheduled_start,
      scheduled_end,
      completed_at,
      created_at,
      updated_at
    `,
    )
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single()

  if (error || !job) {
    notFound()
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("name, email, phone, deleted_at")
    .eq("id", job.customer_id)
    .eq("organization_id", organization.id)
    .single()

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        href={`/org/${slug}/jobs`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-primary">
        ← Back to jobs
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Operations management / Job details
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="wrap-break-word font-mono text-3xl font-semibold tracking-tight text-foreground">
              {job.title}
            </h1>

            <p className="mt-2 text-sm text-muted">
              Created {new Date(job.created_at).toLocaleDateString()}
            </p>
          </div>

          <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium text-primary">
            {job.status === "in_progress"
              ? "In progress"
              : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        </div>
      </header>

      {customer?.deleted_at && (
        <div className="rounded-xl border border-border bg-surface-secondary p-5">
          <p className="text-sm font-medium text-foreground">
            This customer is in Recently Deleted.
          </p>

          <p className="mt-1 text-sm text-muted">
            This record and its customer information remain available. Restore
            the customer from Customers → Recently Deleted before creating new
            linked records.
          </p>

          <Link
            href={`/org/${slug}/customers/${job.customer_id}`}
            className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
            View customer →
          </Link>
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-5 font-mono text-lg font-semibold text-foreground">
          Customer
        </h2>

        <div className="space-y-3">
          <p className="text-base font-medium text-foreground">
            {customer?.name ?? "Unknown customer"}
          </p>

          {customer?.email && (
            <p className="wrap-break-word text-sm text-muted">
              {customer.email}
            </p>
          )}

          {customer?.phone && (
            <p className="text-sm text-muted">{customer.phone}</p>
          )}
        </div>
      </section>

      {(job.estimate_id || job.completed_at) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {job.estimate_id && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-muted">
                Linked estimate
              </p>

              <Link
                href={`/org/${slug}/estimates/${job.estimate_id}`}
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                View estimate →
              </Link>
            </div>
          )}

          {job.completed_at && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-muted">
                Completed
              </p>

              <p className="mt-3 font-mono text-sm font-medium text-foreground">
                {formatOrganizationDateTime(
                  job.completed_at,
                  organization.timezone,
                )}
              </p>
            </div>
          )}
        </section>
      )}

      <JobManager
        key={job.updated_at}
        slug={slug}
        timezone={organization.timezone}
        job={{
          id: job.id,
          title: job.title,
          description: job.description,
          status: job.status as JobStatus,
          scheduled_start: job.scheduled_start,
          scheduled_end: job.scheduled_end,
        }}
      />
    </div>
  )
}
