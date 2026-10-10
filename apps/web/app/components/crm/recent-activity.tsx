import Link from "next/link"

export type Activity = {
  id: string
  type: "lead" | "customer" | "estimate" | "job" | "activity"
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
  activity: "Customer Activity",
}

export function RecentActivity({ activities }: Props) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-base font-semibold text-foreground">
            Recent Activity
          </h2>

          <p className="mt-1 text-sm text-muted">
            Latest updates across your workspace
          </p>
        </div>

        <span className="rounded-md bg-surface-secondary px-3 py-1 font-mono text-xs text-muted">
          {activities.length} records
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-lg bg-surface-secondary p-5">
          <p className="text-sm text-muted">
            Activity will appear here as you use the CRM.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activities.map((activity) => (
            <Link
              key={`${activity.type}-${activity.id}`}
              href={activity.href}
              className="
                flex flex-wrap items-center
                justify-between gap-3
                rounded-md px-2 py-4
                transition-colors
                hover:bg-surface-secondary
              ">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {activity.type === "activity"
                    ? activity.title
                    : activityLabels[activity.type]}
                </p>

                <p className="wrap-break-word text-sm text-muted">
                  {activity.description}
                </p>
              </div>

              <time
                dateTime={activity.createdAt}
                className="shrink-0 font-mono text-xs text-muted">
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
