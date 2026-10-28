import "server-only"

import { createAdminClient } from "@/app/lib/supabase/admin"
import { stripe } from "@/app/lib/stripe/server"
import { STRIPE_PLANS } from "@/app/lib/stripe/plans"

export async function syncStripeSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  const admin = createAdminClient()

  const { data: tracked, error: lookupError } = await admin
    .from("organization_subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  // Ignore subscriptions owned by other applications.
  if (!tracked) {
    return
  }

  const priceId = subscription.items.data[0]?.price.id

  const plan =
    STRIPE_PLANS.starter.priceId && priceId === STRIPE_PLANS.starter.priceId
      ? "starter"
      : STRIPE_PLANS.pro.priceId && priceId === STRIPE_PLANS.pro.priceId
        ? "pro"
        : null

  if (!plan || subscription.items.data.length !== 1) {
    throw new Error("Unknown or unsupported Stripe subscription price")
  }

  const { data: pendingChange, error: changeError } = await admin
    .from("stripe_subscription_changes")
    .select("id, change_type, status")
    .eq("organization_id", tracked.organization_id)
    .eq("stripe_subscription_id", subscription.id)
    .in("status", ["pending", "awaiting_payment", "scheduled"])
    .maybeSingle()

  if (changeError) {
    throw changeError
  }

  const isTerminal =
    subscription.status === "canceled" ||
    subscription.status === "incomplete_expired"

  // A canceled subscription must always reach the database.
  // PostgreSQL will revoke paid entitlements and close
  // any outstanding plan-change request.
  if (isTerminal) {
    const { error } = await admin.rpc("sync_stripe_subscription", {
      p_customer_id: customerId,
      p_subscription_id: subscription.id,
      p_price_id: priceId,
      p_plan_id: plan,
      p_status: subscription.status,
    })

    if (error) {
      throw error
    }

    return
  }

  // Never activate an upgrade or execute a downgrade
  // through ordinary synchronization while the
  // dedicated plan-change workflow is unresolved.
  if (pendingChange) {
    return
  }

  const { error } = await admin.rpc("sync_stripe_subscription", {
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_price_id: priceId,
    p_plan_id: plan,
    p_status: subscription.status,
  })

  if (error) {
    throw error
  }
}
