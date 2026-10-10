import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"
import { JobManager } from "@/app/components/crm/job-manager"

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
    .select("name, email, phone")
    .eq("id", job.customer_id)
    .eq("organization_id", organization.id)
    .single()

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <Link href={`/org/${slug}/jobs`} className="text-sm underline">
        ← Back to Jobs
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{job.title}</h1>

        <p className="text-sm text-gray-500">
          Created {new Date(job.created_at).toLocaleDateString()}
        </p>
      </div>

      <section className="space-y-2 rounded-lg border p-5">
        <h2 className="font-semibold">Customer</h2>

        <p>{customer?.name ?? "Unknown Customer"}</p>

        {customer?.email && (
          <p className="text-sm text-gray-500">{customer.email}</p>
        )}

        {customer?.phone && (
          <p className="text-sm text-gray-500">{customer.phone}</p>
        )}
      </section>

      {job.estimate_id && (
        <Link
          href={`/org/${slug}/estimates/${job.estimate_id}`}
          className="inline-block text-sm underline">
          View Linked Estimate →
        </Link>
      )}

      {job.completed_at && (
        <p className="text-sm text-gray-500">
          Completed {new Date(job.completed_at).toLocaleString()}
        </p>
      )}

      <JobManager
        key={job.updated_at}
        slug={slug}
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
