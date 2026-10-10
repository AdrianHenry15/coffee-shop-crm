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
    .select("id, name, email, phone, notes, status, created_at")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single()

  if (error || !customer) {
    notFound()
  }

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
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <Link href={`/org/${slug}/customers`} className="text-sm underline">
        ← Back to Customers
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{customer.name}</h1>

        <p className="mt-1 text-sm capitalize text-gray-500">
          {customer.status}
        </p>
      </div>

      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Contact Information</h2>

        <p>Email: {customer.email || "Not provided"}</p>
        <p>Phone: {customer.phone || "Not provided"}</p>
      </section>

      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Customer Notes</h2>

        <p className="whitespace-pre-wrap text-sm text-gray-600">
          {customer.notes || "No notes added."}
        </p>
      </section>

      <CustomerActivity
        slug={slug}
        customerId={customer.id}
        userId={user.id}
        activities={activities}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Estimates ({estimates.length})
        </h2>

        {estimates.length === 0 ? (
          <p className="text-sm text-gray-500">No estimates yet.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {estimates.map((estimate) => (
              <Link
                key={estimate.id}
                href={`/org/${slug}/estimates/${estimate.id}`}
                className="flex justify-between gap-4 p-4 hover:bg-gray-50">
                <span>Estimate {estimate.id.slice(0, 8)}</span>

                <span className="text-sm capitalize text-gray-500">
                  {estimate.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Jobs ({jobs.length})</h2>

        {jobs.length === 0 ? (
          <p className="text-sm text-gray-500">No jobs yet.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/org/${slug}/jobs/${job.id}`}
                className="flex justify-between gap-4 p-4 hover:bg-gray-50">
                <span>{job.title}</span>

                <span className="text-sm capitalize text-gray-500">
                  {job.status.replaceAll("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
