import { Database } from "@coffeeshopcrm/database"

type SubscriptionUsage =
  Database["public"]["Functions"]["get_organization_subscription_usage"]["Returns"][number]

type Props = {
  usage: SubscriptionUsage[]
}

const resourceLabels: Record<string, string> = {
  members: "Team Members",
  customers: "Customers",
  leads: "Leads",
  estimates: "Estimates",
  jobs: "Jobs",
}

export function OrganizationSubscription({ usage }: Props) {
  const subscription = usage[0]

  if (!subscription) {
    return null
  }

  return (
    <section className="space-y-4 rounded-lg border p-6">
      <div>
        <h2 className="text-lg font-semibold">Subscription</h2>
        <p className="text-sm text-gray-500">
          Your current plan and resource usage.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-medium">{subscription.plan_name}</span>

        <span className="rounded-full border px-3 py-1 text-xs capitalize">
          {subscription.subscription_status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="space-y-4">
        {usage.map((item) => {
          const percentage =
            item.resource_limit === null
              ? 0
              : item.resource_limit === 0
                ? 100
                : Math.max(
                    0,
                    Math.min((item.used / item.resource_limit) * 100, 100),
                  )

          const isUnlimited = item.resource_limit === null

          const isFull = !isUnlimited && item.used >= item.resource_limit

          const isWarning = !isUnlimited && !isFull && percentage >= 80
          return (
            <div key={item.resource} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{resourceLabels[item.resource] ?? item.resource}</span>

                <span
                  className={
                    isFull
                      ? "font-medium text-red-500"
                      : isWarning
                        ? "font-medium text-amber-500"
                        : "text-neutral-500 dark:text-neutral-400"
                  }>
                  {item.used} /{" "}
                  {isUnlimited ? "Unlimited" : item.resource_limit}
                </span>
              </div>

              {!isUnlimited && (
                <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full ${
                      isFull
                        ? "bg-red-500"
                        : isWarning
                          ? "bg-amber-500"
                          : "bg-blue-600"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
