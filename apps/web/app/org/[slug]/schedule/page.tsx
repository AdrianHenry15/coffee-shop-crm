import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"
import { JobSchedule } from "@/app/components/crm/job-schedule"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function SchedulePage({ params }: Props) {
  const { slug } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const [jobsResult, customersResult] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        `
        id,
        title,
        status,
        customer_id,
        scheduled_start,
        scheduled_end
      `,
      )
      .eq("organization_id", organization.id)
      .not("scheduled_start", "is", null)
      .order("scheduled_start"),

    supabase
      .from("customers")
      .select("id, name")
      .eq("organization_id", organization.id),
  ])

  if (jobsResult.error) {
    throw new Error(jobsResult.error.message)
  }

  if (customersResult.error) {
    throw new Error(customersResult.error.message)
  }

  const customerNames = new Map(
    (customersResult.data ?? []).map((customer) => [
      customer.id,
      customer.name,
    ]),
  )

  const jobs = (jobsResult.data ?? [])
    .filter(
      (job): job is typeof job & { scheduled_start: string } =>
        job.scheduled_start !== null,
    )
    .map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      customerName: customerNames.get(job.customer_id) ?? "Unknown Customer",
      scheduled_start: job.scheduled_start,
      scheduled_end: job.scheduled_end,
    }))

  return (
    <div className="space-y-8">
      <header>
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Operations management
        </p>

        <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
          Schedule
        </h1>

        <p className="mt-2 text-sm text-muted">
          View and manage scheduled customer jobs for {organization.name}.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <JobSchedule slug={slug} jobs={jobs} timezone={organization.timezone} />
      </section>
    </div>
  )
}
