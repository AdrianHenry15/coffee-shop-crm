import { EstimateForm } from "@/app/components/crm/estimate-form"
import { createClient } from "@/app/lib/supabase/server"
import { getOrganization } from "@/lib/organizations"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function EstimatesPage({ params }: Props) {
  const { slug } = await params

  const organization = await getOrganization(slug)
  const supabase = await createClient()

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("organization_id", organization.id)
    .order("name")

  if (error) {
    throw new Error("Unable to load customers.")
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Create Estimate</h1>

        <p className="text-sm text-gray-500">
          Build an estimate for an existing customer.
        </p>
      </div>

      {customers?.length ? (
        <EstimateForm slug={slug} customers={customers} />
      ) : (
        <div className="rounded-lg border p-6">
          <p className="font-medium">No customers available.</p>

          <p className="mt-2 text-sm text-gray-500">
            Create or convert a customer before making an estimate.
          </p>
        </div>
      )}
    </div>
  )
}
