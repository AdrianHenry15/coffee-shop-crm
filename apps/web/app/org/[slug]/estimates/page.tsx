import Link from "next/link"
import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import { EstimateForm } from "@/app/components/crm/forms/estimate-form"
import { Suspense } from "react"
import { RedirectToast } from "@/app/components/crm/ui/redirect-toast"

type Props = {
  params: Promise<{ slug: string }>
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

const estimateMessages = {
  deleted: "Estimate deleted successfully.",
}
export default async function EstimatesPage({ params }: Props) {
  const { slug } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const [customersResult, estimatesResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, deleted_at")
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

  const allCustomers = customersResult.data ?? []

  const customers = allCustomers.filter(
    (customer) => customer.deleted_at === null,
  )

  const estimates = estimatesResult.data ?? []

  const customerNames = new Map(
    allCustomers.map((customer) => [customer.id, customer.name]),
  )

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <RedirectToast messages={estimateMessages} />
      </Suspense>
      <header>
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Sales management
        </p>

        <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
          Estimates
        </h1>

        <p className="mt-2 text-sm text-muted">
          Create and manage customer estimates for {organization.name}.
        </p>
      </header>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Saved estimates
            </h2>

            <p className="mt-1 text-sm text-muted">
              Review estimates, totals, and their current status.
            </p>
          </div>

          <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs font-medium text-foreground">
            {estimates.length} total
          </span>
        </div>

        {estimates.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-mono text-sm font-medium text-foreground">
              No estimates yet
            </p>

            <p className="text-sm text-muted">
              Add a customer or restore one from Recently Deleted before
              creating an estimate.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {estimates.map((estimate) => {
              const totalCents = estimate.estimate_items.reduce(
                (total, item) => total + item.quantity * item.unit_price_cents,
                0,
              )

              return (
                <div
                  key={estimate.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0 space-y-2">
                    <p className="font-medium text-foreground">
                      {customerNames.get(estimate.customer_id) ??
                        "Unknown customer"}
                    </p>

                    <p className="font-mono text-xs text-muted">
                      {new Date(estimate.created_at).toLocaleDateString()}
                    </p>

                    <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium capitalize text-primary">
                      {estimate.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="space-y-2 text-right">
                    <p className="font-mono text-lg font-semibold text-foreground">
                      {formatMoney(totalCents)}
                    </p>

                    <Link
                      href={`/org/${slug}/estimates/${estimate.id}`}
                      className="inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary hover:text-primary">
                      View details
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Create estimate
          </h2>

          <p className="mt-1 text-sm text-muted">
            Prepare a new estimate for an existing customer.
          </p>
        </div>

        {customers.length > 0 ? (
          <EstimateForm slug={slug} customers={customers} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface-secondary p-6">
            <p className="text-sm text-muted">
              You need at least one customer before creating an estimate.
            </p>

            <Link
              href={`/org/${slug}/customers`}
              className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
              Go to customers →
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
