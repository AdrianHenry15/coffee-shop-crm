import Link from "next/link"
import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import { EstimateForm } from "@/app/components/crm/estimate-form"

type Props = {
  params: Promise<{ slug: string }>
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

export default async function EstimatesPage({ params }: Props) {
  const { slug } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const [customersResult, estimatesResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("organization_id", organization.id)
      .order("name"),

    supabase
      .from("estimates")
      .select(
        `
        id,
        customer_id,
        status,
        notes,
        created_at,
        estimate_items (
          id,
          quantity,
          unit_price_cents
        )
      `,
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
  ])

  if (customersResult.error) {
    throw new Error("Unable to load customers.")
  }

  if (estimatesResult.error) {
    throw new Error("Unable to load estimates.")
  }

  const customers = customersResult.data ?? []
  const estimates = estimatesResult.data ?? []

  const customerNames = new Map(
    customers.map((customer) => [customer.id, customer.name]),
  )

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-bold">Estimates</h1>
        <p className="text-sm text-gray-500">
          Create and manage customer estimates.
        </p>
      </div>

      {/* SAVED ESTIMATES */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          Saved Estimates ({estimates.length})
        </h2>

        {estimates.length === 0 ? (
          <div className="rounded-lg border p-6">
            <p className="text-sm text-gray-500">No estimates created yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="divide-y">
              {estimates.map((estimate) => {
                const totalCents = estimate.estimate_items.reduce(
                  (total, item) =>
                    total + item.quantity * item.unit_price_cents,
                  0,
                )

                return (
                  <div
                    key={estimate.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {customerNames.get(estimate.customer_id) ??
                          "Unknown Customer"}
                      </p>

                      <p className="text-xs text-gray-500">
                        {new Date(estimate.created_at).toLocaleDateString()}
                      </p>

                      <p className="text-sm capitalize">
                        Status: {estimate.status}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        {formatMoney(totalCents)}
                      </p>

                      <Link
                        href={`/org/${slug}/estimates/${estimate.id}`}
                        className="text-sm underline">
                        View Details
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* CREATE ESTIMATE */}
      <section className="space-y-4 border-t pt-8">
        <h2 className="text-xl font-semibold">Create Estimate</h2>

        {customers.length > 0 ? (
          <EstimateForm slug={slug} customers={customers} />
        ) : (
          <p className="text-sm text-gray-500">
            Create a customer before making an estimate.
          </p>
        )}
      </section>
    </div>
  )
}
