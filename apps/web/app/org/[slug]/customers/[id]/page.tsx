import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"
import { CustomerActivity } from "@/app/components/crm/customer-activity"

type Props = {
  params: Promise<{
    slug: string
    id: string
  }>
}

export default async function CustomerDetailsPage({ params }: Props) {
  const { slug, id } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, notes, status, created_at, deleted_at")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single()

  if (error || !customer) {
    notFound()
  }

  const isDeleted = customer.deleted_at !== null

  const [estimatesResult, jobsResult, activitiesResult] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, status, created_at")
      .eq("organization_id", organization.id)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("jobs")
      .select("id, title, status, scheduled_start")
      .eq("organization_id", organization.id)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("customer_activities")
      .select("id, type, content, created_by, created_at")
      .eq("organization_id", organization.id)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
  ])

  if (estimatesResult.error || jobsResult.error || activitiesResult.error) {
    throw new Error("Unable to load customer history.")
  }

  const estimates = estimatesResult.data ?? []
  const activities = activitiesResult.data ?? []
  const jobs = jobsResult.data ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        href={`/org/${slug}/customers`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-primary">
        ← Back to customers
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Customer management / Details
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
            {customer.name}
          </h1>

          <span className="rounded-full bg-surface-secondary px-3 py-1 font-mono text-xs font-medium capitalize text-foreground">
            {isDeleted ? "Recently Deleted" : customer.status}
          </span>
        </div>

        <p className="text-sm text-muted">
          Customer profile, interactions, estimates, and jobs.
        </p>
      </header>

      {isDeleted && (
        <section className="rounded-xl border border-border bg-surface-secondary p-5">
          <h2 className="font-mono text-base font-semibold text-foreground">
            This customer is in Recently Deleted
          </h2>

          <p className="mt-2 text-sm text-muted">
            This customer still counts toward your plan’s limit. Their profile
            and activity history are available to view. Restore the customer
            before editing their profile or adding new activity, estimates, or
            jobs.
          </p>

          <p className="mt-2 text-sm text-muted">
            Open Customers and select Recently Deleted to restore this customer
            or permanently delete them. Customers with linked estimates or jobs
            cannot be permanently deleted.
          </p>

          <Link
            href={`/org/${slug}/customers`}
            className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
            Go to customers →
          </Link>
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-5 font-mono text-lg font-semibold text-foreground">
            Contact information
          </h2>

          <div className="space-y-5">
            <div>
              <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">
                Email
              </p>
              <p className="wrap-break-word text-sm text-foreground">
                {customer.email || "Not provided"}
              </p>
            </div>

            <div>
              <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">
                Phone
              </p>
              <p className="text-sm text-foreground">
                {customer.phone || "Not provided"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-5 font-mono text-lg font-semibold text-foreground">
            Customer notes
          </h2>

          <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-muted">
            {customer.notes || "No notes added."}
          </p>
        </section>
      </div>

      {isDeleted ? (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <div>
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Activity history
            </h2>

            <p className="mt-1 text-sm text-muted">
              Restore this customer to add or manage activity.
            </p>
          </div>

          {activities.length === 0 ? (
            <p className="text-sm text-muted">No activity recorded.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activities.map((activity) => (
                <li key={activity.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs font-medium capitalize text-primary">
                      {activity.type}
                    </p>

                    <time
                      dateTime={activity.created_at}
                      className="text-xs text-muted">
                      {new Date(activity.created_at).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        },
                      )}
                    </time>
                  </div>

                  <p className="whitespace-pre-wrap wrap-break-word text-sm text-foreground">
                    {activity.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <CustomerActivity
          slug={slug}
          customerId={customer.id}
          userId={user.id}
          activities={activities}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Estimates
            </h2>

            <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted">
              {estimates.length} total
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {estimates.length === 0 ? (
              <p className="p-6 text-sm text-muted">No estimates yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {estimates.map((estimate) => (
                  <Link
                    key={estimate.id}
                    href={`/org/${slug}/estimates/${estimate.id}`}
                    className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-secondary">
                    <span className="font-mono text-sm font-medium text-foreground">
                      Estimate {estimate.id.slice(0, 8)}
                    </span>

                    <span className="text-xs capitalize text-muted">
                      {estimate.status.replaceAll("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Jobs
            </h2>

            <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted">
              {jobs.length} total
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {jobs.length === 0 ? (
              <p className="p-6 text-sm text-muted">No jobs yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/org/${slug}/jobs/${job.id}`}
                    className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-secondary">
                    <span className="text-sm font-medium text-foreground">
                      {job.title}
                    </span>

                    <span className="text-xs capitalize text-muted">
                      {job.status.replaceAll("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
