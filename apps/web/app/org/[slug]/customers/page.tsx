import { getOrganization } from "@/lib/organizations"
import { createCustomer } from "./actions"
import { createClient } from "@/app/lib/supabase/server"

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
    .select("id, name, email, phone, status, created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("Unable to load customers.")
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Customers</h1>
        <p className="mt-2 text-gray-500">
          Manage customers for {organization.name}.
        </p>
      </div>

      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-semibold">Add customer</h2>

        <form action={createCustomer} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              name="name"
              required
              maxLength={200}
              placeholder="Name"
              className="rounded-md border p-3"
            />

            <input
              name="email"
              type="email"
              placeholder="Email"
              className="rounded-md border p-3"
            />

            <input
              name="phone"
              placeholder="Phone"
              className="rounded-md border p-3"
            />

            <input
              name="notes"
              placeholder="Notes"
              className="rounded-md border p-3"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-black px-5 py-3 text-white">
            Create customer
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          All customers ({customers?.length ?? 0})
        </h2>

        {!customers?.length ? (
          <p className="rounded-lg border p-5 text-gray-500">
            No customers yet.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-medium">{customer.name}</p>

                  <p className="text-sm text-gray-500">
                    {customer.email ||
                      customer.phone ||
                      "No contact information"}
                  </p>
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-black">
                  {customer.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
