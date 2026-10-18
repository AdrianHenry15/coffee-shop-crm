import Link from "next/link"
import { createClient } from "@/app/lib/supabase/server"

type SearchParams = {
  search?: string
  page?: string
}

const PAGE_SIZE = 20

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  const search = (params.search ?? "").trim()
  const requestedPage = Number(params.page ?? "1")
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_platform_organizations", {
    search_term: search,
    page_number: page,
    page_size: PAGE_SIZE,
  })

  if (error) {
    throw new Error("Unable to load organizations.")
  }

  const organizations = data ?? []
  const total = organizations[0]?.total_count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function pageUrl(nextPage: number) {
    const query = new URLSearchParams()

    if (search) query.set("search", search)

    query.set("page", String(nextPage))

    return `/admin/organizations?${query.toString()}`
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          ← Administration
        </Link>

        <h1 className="mt-3 text-3xl font-semibold">Organizations</h1>

        <p className="mt-2 text-gray-500">
          Manage organizations across the TGS platform.
        </p>
      </div>

      <form action="/admin/organizations" method="get" className="flex gap-2">
        <input
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Search organizations..."
          className="w-full max-w-md rounded-md border px-3 py-2"
        />

        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-white">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Benefits</th>
              <th className="px-4 py-3 font-medium">Subscription</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {organizations.map((organization) => (
              <tr key={organization.organization_id}>
                <td className="px-4 py-4">
                  <Link
                    href={`/admin/organizations/${organization.organization_id}`}
                    className="font-medium hover:underline">
                    {organization.organization_name}
                  </Link>

                  <p className="mt-1 text-xs text-gray-500">
                    {organization.organization_slug}
                  </p>
                </td>

                <td className="px-4 py-4">{organization.plan_name ?? "—"}</td>

                <td className="px-4 py-4">
                  <span className="capitalize">
                    {organization.benefit_level.replace("_plus", "+")}
                  </span>
                </td>

                <td className="px-4 py-4 capitalize">
                  {organization.subscription_status?.replaceAll("_", " ") ??
                    "—"}
                </td>

                <td className="px-4 py-4">
                  {new Date(
                    organization.organization_created_at,
                  ).toLocaleDateString("en-US", {
                    timeZone: "UTC",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {organizations.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No organizations found.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {total} organization{total === 1 ? "" : "s"}
        </p>

        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={pageUrl(page - 1)}
              className="rounded-md border px-4 py-2 text-sm">
              Previous
            </Link>
          )}

          {page < totalPages && (
            <Link
              href={pageUrl(page + 1)}
              className="rounded-md border px-4 py-2 text-sm">
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
