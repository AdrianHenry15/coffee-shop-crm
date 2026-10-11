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
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Subscription
        </h2>

        <p className="mt-1 text-sm text-muted">
          Your current plan and resource usage.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface-secondary p-4">
        <div className="space-y-1">
          <p className="font-mono text-xs font-medium uppercase tracking-wide text-muted">
            Current plan
          </p>

          <p className="font-mono text-xl font-semibold text-foreground">
            {subscription.plan_name}
          </p>
        </div>

        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium capitalize text-foreground">
          {subscription.subscription_status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="space-y-5">
        <div>
          <h3 className="font-mono text-sm font-semibold text-foreground">
            Resource usage
          </h3>

          <p className="mt-1 text-xs text-muted">
            Track your usage against your plan limits.
          </p>
        </div>

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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {resourceLabels[item.resource] ?? item.resource}
                </span>

                <span
                  className={`font-mono text-xs font-medium ${
                    isFull
                      ? "text-red-500"
                      : isWarning
                        ? "text-amber-500"
                        : "text-muted"
                  }`}>
                  {item.used} /{" "}
                  {isUnlimited ? "Unlimited" : item.resource_limit}
                </span>
              </div>

              {!isUnlimited && (
                <div
                  role="progressbar"
                  aria-label={`${resourceLabels[item.resource] ?? item.resource} usage`}
                  aria-valuemin={0}
                  aria-valuemax={item.resource_limit}
                  aria-valuenow={Math.min(
                    Math.max(item.used, 0),
                    item.resource_limit,
                  )}
                  className="h-2 overflow-hidden rounded-full bg-surface-secondary">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isFull
                        ? "bg-red-500"
                        : isWarning
                          ? "bg-amber-500"
                          : "bg-primary"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}

              {isUnlimited && (
                <p className="text-xs text-muted">
                  No usage limit on your current plan.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
