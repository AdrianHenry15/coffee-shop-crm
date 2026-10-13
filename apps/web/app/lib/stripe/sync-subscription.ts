import "server-only"

import { createAdminClient } from "@/app/lib/supabase/admin"
import { stripe } from "@/app/lib/stripe/server"
import { STRIPE_PLANS } from "@/app/lib/stripe/plans"

export async function syncStripeSubscription(subscriptionId: string) {
  // Always retrieve the latest state from Stripe.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  const priceId = subscription.items.data[0]?.price.id

  const plan =
    priceId === STRIPE_PLANS.starter.priceId
      ? "starter"
      : priceId === STRIPE_PLANS.pro.priceId
        ? "pro"
        : null

  if (!plan || subscription.items.data.length !== 1) {
    throw new Error("Unknown or unsupported Stripe subscription price")
  }

  const admin = createAdminClient()

  // Only synchronize subscriptions already linked to an organization.
  const { data: tracked, error: lookupError } = await admin
    .from("organization_subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle()

  if (lookupError) {
    throw new Error(
      `Unable to verify Stripe subscription: ${lookupError.message}`,
    )
  }

  if (!tracked) {
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
    throw new Error(`Stripe synchronization failed: ${error.message}`)
  }
}
