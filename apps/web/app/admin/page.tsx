import Link from "next/link"

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Platform Overview</h1>

        <p className="mt-2 text-gray-500">
          Manage Third Generation Studios clients and platform services.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/organizations"
          className="rounded-lg border p-6 transition-colors hover:bg-gray-50">
          <h2 className="text-xl font-semibold">Organizations</h2>

          <p className="mt-2 text-sm text-gray-500">
            View client organizations, subscriptions, and Partner benefits.
          </p>
        </Link>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Platform Activity</h2>

          <p className="mt-2 text-sm text-gray-500">
            Administrative activity and benefit changes.
          </p>

          <p className="mt-4 text-xs text-gray-400">Coming soon</p>
        </div>
      </div>
    </div>
  )
}
