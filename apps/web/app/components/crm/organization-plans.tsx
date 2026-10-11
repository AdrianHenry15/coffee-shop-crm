import type { Database } from "@coffeeshopcrm/database"

type BillingPlan = Database["public"]["Tables"]["billing_plans"]["Row"]

type Props = {
  plans: BillingPlan[]
  currentPlanId: string
}

const resources: {
  key: keyof Pick<
    BillingPlan,
    "max_members" | "max_customers" | "max_leads" | "max_estimates" | "max_jobs"
  >
  label: string
}[] = [
  { key: "max_members", label: "Team members" },
  { key: "max_customers", label: "Customers" },
  { key: "max_leads", label: "Leads" },
  { key: "max_estimates", label: "Estimates" },
  { key: "max_jobs", label: "Jobs" },
]

export function OrganizationPlans({ plans, currentPlanId }: Props) {
  return (
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Compare plans
        </h2>

        <p className="mt-1 text-sm text-muted">
          Explore available subscription plans and compare resource limits.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId

          return (
            <div
              key={plan.id}
              className={`flex flex-col gap-5 rounded-xl border p-5 ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background"
              }`}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-mono text-lg font-semibold text-foreground">
                    {plan.name}
                  </h3>

                  {isCurrent && (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      Current
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted">
                  {isCurrent
                    ? "Your organization's active plan."
                    : "Available subscription tier."}
                </p>
              </div>

              <div className="flex-1 space-y-4 border-t border-border pt-5">
                <p className="font-mono text-xs font-medium uppercase tracking-wide text-muted">
                  Resource limits
                </p>

                {resources.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted">{label}</span>

                    <span className="font-mono font-medium text-foreground">
                      {plan[key] ?? "Unlimited"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                {isCurrent ? (
                  <div className="rounded-lg bg-primary/10 px-4 py-3 text-center text-sm font-medium text-primary">
                    Your current plan
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-surface-secondary px-4 py-3 text-center text-sm text-muted">
                    Coming soon
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
