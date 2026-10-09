import { getOrganization } from "@/lib/organizations"
import { logout } from "@/app/auth/actions"

export default async function OrganizationDashboard({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const organization = await getOrganization(slug)

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">CoffeeShopCRM</p>

          <h1 className="text-3xl font-semibold">{organization.name}</h1>
        </div>

        <form action={logout}>
          <button type="submit" className="rounded-md border px-4 py-2">
            Log out
          </button>
        </form>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Dashboard</h2>

        <p className="mt-2 text-gray-500">Your CRM workspace is ready.</p>
      </section>
    </main>
  )
}
