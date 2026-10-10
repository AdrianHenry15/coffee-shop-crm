import { getOrganization } from "@/lib/organizations"
import { createLead } from "./actions"
import { createClient } from "@/app/lib/supabase/server"
import { LeadManager } from "@/app/components/crm/managers/lead-manager"
import { SubmitButton } from "@/app/components/crm/ui/submit-button"
import { LeadForm } from "@/app/components/crm/forms/lead-form"

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
    .select("id, name, email, phone, notes, status, created_at")
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
      <div>
        <h1 className="text-3xl font-semibold">Leads</h1>
        <p className="mt-2 text-gray-500">
          Manage potential customers for {organization.name}.
        </p>
      </div>

      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-semibold">Add lead</h2>

        <LeadForm slug={slug} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          All leads ({leads?.length ?? 0})
        </h2>
        <LeadManager slug={slug} leads={leadsWithCustomers} />
      </section>
    </div>
  )
}
