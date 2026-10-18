import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import { CustomerManager } from "@/app/components/crm/managers/customer-manager"
import { CustomerForm } from "@/app/components/crm/forms/customer-form"
import { Suspense } from "react"
import { RedirectToast } from "@/app/components/crm/ui/redirect-toast"
import { CsvImporter } from "@/app/components/crm/csv-importer"
import { importCustomers } from "./actions"

const customerMessages = {
  converted: "Lead converted to customer successfully.",
}
export default async function CustomersPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const { data: customers, error } = await supabase
    .from("customers")
    .select(
      "id, name, email, phone, notes, status, lead_id, created_at, deleted_at",
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("Unable to load customers.")
  }

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <RedirectToast messages={customerMessages} />
      </Suspense>

      <header>
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Customer management
        </p>

        <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
          Customers
        </h1>

        <p className="mt-2 text-sm text-muted">
          Manage customers for {organization.name}.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Add customer
          </h2>

          <p className="mt-1 text-sm text-muted">
            Add a customer to your business directory.
          </p>
        </div>

        <CustomerForm slug={slug} />
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-lg font-semibold text-foreground">
              All customers
            </h2>

            <p className="mt-1 text-sm text-muted">
              View and manage your customer relationships.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs font-medium text-foreground">
              {customers?.filter((customer) => customer.deleted_at === null)
                .length ?? 0}{" "}
              total
            </span>

            <CsvImporter
              entity="customers"
              onImport={importCustomers.bind(null, slug)}
            />
          </div>
        </div>

        <CustomerManager slug={slug} customers={customers ?? []} />
      </section>
    </div>
  )
}
