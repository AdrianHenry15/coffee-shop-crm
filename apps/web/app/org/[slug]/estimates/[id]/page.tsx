import Link from "next/link"
import { notFound } from "next/navigation"
import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import {
  EstimateManager,
  EstimateStatus,
} from "@/app/components/crm/managers/estimate-manager"
import { EstimateItemEditor } from "@/app/components/crm/estimate-item-editor"
import { Suspense } from "react"
import { RedirectToast } from "@/app/components/crm/ui/redirect-toast"

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

const estimateMessages = {
  created: "Estimate created successfully.",
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
    <div className="mx-auto max-w-5xl space-y-8">
      <Suspense fallback={null}>
        <RedirectToast messages={estimateMessages} />
      </Suspense>

      <Link
        href={`/org/${slug}/estimates`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-primary">
        ← Back to estimates
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Sales management / Estimate details
        </p>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
              Estimate details
            </h1>

            <p className="mt-2 text-sm text-muted">
              Created {new Date(estimate.created_at).toLocaleDateString()}
            </p>
          </div>

          <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium capitalize text-primary">
            {estimate.status}
          </span>
        </div>
      </header>

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

      <section className="space-y-5">
        <div>
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Estimate items
          </h2>

          <p className="mt-1 text-sm text-muted">
            Services and pricing included in this estimate.
          </p>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 space-y-2">
                <p className="font-medium text-foreground">
                  {item.description}
                </p>

                <p className="font-mono text-xs text-muted">
                  {item.quantity} × {formatMoney(item.unit_price_cents)}
                </p>
              </div>

              <p className="font-mono text-sm font-semibold text-foreground">
                {formatMoney(item.quantity * item.unit_price_cents)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface-secondary p-6">
          <div>
            <p className="font-mono text-sm font-semibold text-foreground">
              Estimate total
            </p>

            <p className="mt-1 text-xs text-muted">
              Total value of all services
            </p>
          </div>

          <span className="font-mono text-2xl font-semibold text-primary">
            {formatMoney(totalCents)}
          </span>
        </div>
      </section>

      {estimate.status === "draft" && (
        <EstimateItemEditor
          status={estimate.status}
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
