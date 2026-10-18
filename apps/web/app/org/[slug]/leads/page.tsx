import { getOrganization } from "@/lib/organizations"
import { createClient } from "@/app/lib/supabase/server"
import { LeadManager } from "@/app/components/crm/managers/lead-manager"
import { LeadForm } from "@/app/components/crm/forms/lead-form"
import { CsvImporter } from "@/app/components/crm/csv-importer"
import { importLeads } from "./actions"

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, email, phone, notes, status, created_at, deleted_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, lead_id")
    .eq("organization_id", organization.id)
    .not("lead_id", "is", null)

  if (customersError) {
    throw new Error(customersError.message)
  }

  const customerByLeadId = new Map(
    (customers ?? []).map((customer) => [customer.lead_id, customer.id]),
  )

  const leadsWithCustomers = (leads ?? []).map((lead) => {
    const customerId = customerByLeadId.get(lead.id)

    return {
      ...lead,
      customers: customerId ? [{ id: customerId }] : [],
    }
  })

  return (
    <div className="space-y-8">
      <header>
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Customer management
        </p>

        <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
          Leads
        </h1>

        <p className="mt-2 text-sm text-muted">
          Manage potential customers for {organization.name}.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Add lead
          </h2>

          <p className="mt-1 text-sm text-muted">
            Capture a new opportunity for your business.
          </p>
        </div>

        <LeadForm slug={slug} />
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-lg font-semibold text-foreground">
              All leads
            </h2>

            <p className="mt-1 text-sm text-muted">
              Track and manage your incoming opportunities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs font-medium text-foreground">
              {
                leadsWithCustomers.filter((lead) => lead.deleted_at === null)
                  .length
              }{" "}
              total
            </span>

            <CsvImporter
              entity="leads"
              onImport={importLeads.bind(null, slug)}
            />
          </div>
        </div>

        <LeadManager slug={slug} leads={leadsWithCustomers} />
      </section>
    </div>
  )
}
