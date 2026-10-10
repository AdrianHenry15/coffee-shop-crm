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
    <section className="space-y-4 rounded-lg border p-6">
      <div>
        <h2 className="text-lg font-semibold">Compare Plans</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Explore the available subscription plans.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId

          return (
            <div
              key={plan.id}
              className={`flex flex-col gap-4 rounded-lg border p-4 ${
                isCurrent ? "border-blue-500" : ""
              }`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{plan.name}</h3>

                {isCurrent && (
                  <span className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
                    Current
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-3">
                {resources.map(({ key, label }) => (
                  <div key={key} className="flex justify-between gap-2 text-sm">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {label}
                    </span>

                    <span className="font-medium">
                      {plan[key] ?? "Unlimited"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 text-center text-sm">
                {isCurrent ? (
                  <span className="font-medium">Your current plan</span>
                ) : (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Coming soon
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
