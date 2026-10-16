import { createClient } from "@/app/lib/supabase/server"
import { createAdminClient } from "@/app/lib/supabase/admin"
import { getOrganization } from "@/lib/organizations"
import { createCheckoutSession } from "./actions"
import { createBillingPortalSession } from "./portal-actions"
import { UpgradeButton } from "./upgrade-button"
import { RecoverCheckoutButton } from "./recover-checkout-button"
import { stripe } from "@/app/lib/stripe/server"

type BillingPageProps = {
  params: Promise<{ slug: string }>
}

const PLANS = {
  free: {
    name: "Free",
    price: 0,
    description: "Get started with CoffeeShopCRM.",
  },
  starter: {
    name: "Starter",
    price: 24,
    description: "More room to grow your business.",
  },
  pro: {
    name: "Pro",
    price: 59,
    description: "Advanced tools for growing businesses.",
  },
} as const

export default async function BillingPage({ params }: BillingPageProps) {
  const { slug } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <p>You must be signed in to view billing.</p>
  }

  const organization = await getOrganization(slug)

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single()

  if (!membership || membership.role !== "owner") {
    return <p>Only organization owners can manage billing.</p>
  }

  const admin = createAdminClient()

  const { data: subscription, error } = await admin
    .from("organization_subscriptions")
    .select(
      "plan_id, status, stripe_customer_id, stripe_subscription_id, stripe_subscription_status",
    )
    .eq("organization_id", organization.id)
    .single()

  if (error || !subscription) {
    return <p>Unable to load billing information.</p>
  }

  const { data: pendingCheckout } = await admin
    .from("stripe_checkout_reservations")
    .select("id, stripe_session_id")
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .not("stripe_session_id", "is", null)
    .maybeSingle()

  const planId =
    subscription.plan_id === "starter" || subscription.plan_id === "pro"
      ? subscription.plan_id
      : "free"

  const plan = PLANS[planId]
  const hasStripeCustomer = Boolean(subscription.stripe_customer_id)
  const isFree = planId === "free"

  const subscriptionStatus =
    subscription.stripe_subscription_status ?? "Not subscribed"

  const stripeStatus = subscription.stripe_subscription_status

  const hasUnresolvedStripeSubscription = [
    "active",
    "trialing",
    "past_due",
    "unpaid",
    "incomplete",
    "paused",
  ].includes(stripeStatus ?? "")

  const isTerminalStripeStatus = ["canceled", "incomplete_expired"].includes(
    stripeStatus ?? "",
  )

  const canStartCheckout =
    isFree &&
    !hasUnresolvedStripeSubscription &&
    (!subscription.stripe_subscription_id || isTerminalStripeStatus)

  let cancellationLabel: string | null = null
  let cancellationScheduled = false
  let cancellationStatusChecked = false

  if (subscription.stripe_subscription_id && !isFree) {
    try {
      const liveSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id,
      )

      cancellationStatusChecked = true
      cancellationScheduled =
        liveSubscription.cancel_at_period_end ||
        Boolean(liveSubscription.cancel_at)

      if (cancellationScheduled) {
        cancellationLabel = liveSubscription.cancel_at
          ? `Cancels on ${new Date(
              liveSubscription.cancel_at * 1000,
            ).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}`
          : "Cancels at period end"
      }
    } catch (error) {
      console.error("Unable to retrieve Stripe cancellation status:", error)
    }
  }

  const canUpgradeToPro =
    planId === "starter" &&
    stripeStatus === "active" &&
    !cancellationLabel &&
    Boolean(
      subscription.stripe_subscription_id && subscription.stripe_customer_id,
    ) &&
    cancellationStatusChecked &&
    !cancellationScheduled

  let canRecoverCheckout = false

  if (pendingCheckout?.stripe_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        pendingCheckout.stripe_session_id,
      )

      canRecoverCheckout =
        session.status === "complete" && session.payment_status === "paid"
    } catch (error) {
      console.error("Unable to check pending Checkout:", error)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Billing & Subscription
        </h1>

        <p className="text-sm text-gray-500">
          Manage your CoffeeShopCRM plan and billing information.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">Current plan</p>

            <h2 className="text-2xl font-semibold text-gray-900">
              {plan.name}
            </h2>

            <p className="text-sm text-gray-500">{plan.description}</p>
          </div>

          <div className="text-right">
            <p className="text-3xl font-semibold text-gray-900">
              ${plan.price}
              <span className="text-sm font-normal text-gray-500">/month</span>
            </p>

            <span className="mt-2 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
              {isFree && hasUnresolvedStripeSubscription
                ? "Subscription sync needed"
                : isFree
                  ? "Free plan"
                  : (cancellationLabel ?? subscriptionStatus)}
            </span>
          </div>
        </div>

        {isFree && hasStripeCustomer && canRecoverCheckout && (
          <div className="mt-6 border-t border-gray-100 pt-6">
            <p className="mb-3 text-sm text-gray-600">
              Recover a completed Checkout that has not synced yet.
            </p>

            <RecoverCheckoutButton slug={slug} />
          </div>
        )}

        {hasStripeCustomer && (
          <div className="mt-6 border-t border-gray-100 pt-6">
            <form action={createBillingPortalSession.bind(null, slug)}>
              <button
                type="submit"
                className="rounded-lg bg-green-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-green-800">
                Manage Billing
              </button>
            </form>

            <p className="mt-2 text-xs text-gray-500">
              Securely manage payment methods, invoices, and subscription
              cancellation through Stripe.
            </p>
          </div>
        )}
      </section>

      {canUpgradeToPro && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Upgrade your plan</h2>
            <p className="text-sm text-gray-500">
              Upgrade from Starter to Pro.
            </p>
          </div>

          <div className="max-w-md rounded-2xl border border-green-800 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Pro</h3>

            <p className="mt-3 text-3xl font-semibold">
              $59
              <span className="text-sm font-normal text-gray-500">/month</span>
            </p>

            <p className="mt-3 text-sm text-gray-500">
              Advanced tools for growing businesses.
            </p>

            <div className="mt-6">
              <UpgradeButton slug={slug} enabled={canUpgradeToPro} />
            </div>
          </div>
        </section>
      )}

      {canStartCheckout && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Upgrade your plan</h2>

            <p className="text-sm text-gray-500">
              Choose the plan that fits your business.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Starter</h3>

              <p className="mt-3 text-3xl font-semibold">
                $24
                <span className="text-sm font-normal text-gray-500">
                  /month
                </span>
              </p>

              <p className="mt-3 text-sm text-gray-500">
                More room to grow your business.
              </p>

              <form
                action={createCheckoutSession.bind(null, slug, "starter")}
                className="mt-6">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-green-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-800">
                  Choose Starter
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-green-800 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Pro</h3>

              <p className="mt-3 text-3xl font-semibold">
                $59
                <span className="text-sm font-normal text-gray-500">
                  /month
                </span>
              </p>

              <p className="mt-3 text-sm text-gray-500">
                Advanced tools for growing businesses.
              </p>

              <form
                action={createCheckoutSession.bind(null, slug, "pro")}
                className="mt-6">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-green-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-800">
                  Choose Pro
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
