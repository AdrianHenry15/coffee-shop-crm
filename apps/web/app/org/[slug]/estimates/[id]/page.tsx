import Link from "next/link"
import { notFound } from "next/navigation"
import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import {
  EstimateManager,
  EstimateStatus,
} from "@/app/components/crm/estimate-manager"
import { EstimateItemEditor } from "@/app/components/crm/estimate-item-editor"

type Props = {
  params: Promise<{
    slug: string
    id: string
  }>
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

export default async function EstimateDetailsPage({ params }: Props) {
  const { slug, id } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select(
      `
      id,
      customer_id,
      status,
      notes,
      created_at,
      updated_at,
      estimate_items (
        id,
        description,
        quantity,
        unit_price_cents,
        position
      )
    `,
    )
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single()

  if (error || !estimate) {
    notFound()
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("name, email, phone")
    .eq("id", estimate.customer_id)
    .eq("organization_id", organization.id)
    .single()

  const items = [...estimate.estimate_items].sort(
    (a, b) => a.position - b.position,
  )

  const totalCents = items.reduce(
    (total, item) => total + item.quantity * item.unit_price_cents,
    0,
  )

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <Link href={`/org/${slug}/estimates`} className="text-sm underline">
        ← Back to Estimates
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estimate Details</h1>

          <p className="text-sm text-gray-500">
            Created {new Date(estimate.created_at).toLocaleDateString()}
          </p>
        </div>

        <span className="rounded-full border px-3 py-1 text-sm capitalize">
          {estimate.status}
        </span>
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Estimate Items</h2>

        <div className="overflow-hidden rounded-lg border">
          <div className="divide-y">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{item.description}</p>

                  <p className="text-sm text-gray-500">
                    {item.quantity} × {formatMoney(item.unit_price_cents)}
                  </p>
                </div>

                <p className="font-medium">
                  {formatMoney(item.quantity * item.unit_price_cents)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between rounded-lg border p-5">
          <span className="font-semibold">Total</span>

          <span className="text-xl font-bold">{formatMoney(totalCents)}</span>
        </div>
      </section>

      {estimate.status === "draft" && (
        <EstimateItemEditor
          key={estimate.updated_at}
          slug={slug}
          estimateId={estimate.id}
          initialItems={items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unit_price_cents,
          }))}
        />
      )}
      <EstimateManager
        slug={slug}
        estimate={{
          id: estimate.id,
          status: estimate.status as EstimateStatus,
          notes: estimate.notes,
        }}
      />
    </div>
  )
}
