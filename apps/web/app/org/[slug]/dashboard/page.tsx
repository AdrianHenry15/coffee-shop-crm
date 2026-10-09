import { getOrganization } from "@/lib/organizations"

export default async function OrganizationDashboard({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const organization = await getOrganization(slug)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>

        <p className="mt-2 text-gray-500">Overview of {organization.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Leads", "Customers", "Estimates", "Jobs"].map((label) => (
          <div key={label} className="rounded-lg border p-5">
            <p className="text-sm text-gray-500">{label}</p>

            <p className="mt-3 text-3xl font-semibold">—</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border p-6">
        <h2 className="font-semibold">Recent activity</h2>

        <p className="mt-2 text-sm text-gray-500">
          Activity will appear here as you use the CRM.
        </p>
      </section>
    </div>
  )
}
