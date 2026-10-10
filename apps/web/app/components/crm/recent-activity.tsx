import Link from "next/link"

export type Activity = {
  id: string
  type: "lead" | "customer" | "estimate" | "job"
  title: string
  description: string
  createdAt: string
  href: string
}

type Props = {
  activities: Activity[]
}

const activityLabels = {
  lead: "New Lead",
  customer: "Customer Added",
  estimate: "Estimate Created",
  job: "Job Created",
}

export function RecentActivity({ activities }: Props) {
  return (
    <section className="rounded-lg border p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-semibold">Recent Activity</h2>

        <span className="text-xs text-gray-500">
          Latest {activities.length} records
        </span>
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-gray-500">
          Activity will appear here as you use the CRM.
        </p>
      ) : (
        <div className="divide-y">
          {activities.map((activity) => (
            <Link
              key={`${activity.type}-${activity.id}`}
              href={activity.href}
              className="flex flex-wrap items-center justify-between gap-3 py-4 transition hover:opacity-70">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {activityLabels[activity.type]}
                </p>

                <p className="text-sm text-gray-500">{activity.description}</p>
              </div>

              <time
                dateTime={activity.createdAt}
                className="text-xs text-gray-500">
                {new Date(activity.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
