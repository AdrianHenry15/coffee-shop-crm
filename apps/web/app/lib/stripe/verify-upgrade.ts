import "server-only"

import { createAdminClient } from "@/app/lib/supabase/admin"
import { stripe } from "@/app/lib/stripe/server"
import { STRIPE_PLANS } from "@/app/lib/stripe/plans"

export async function verifyAndCompleteUpgrade(invoiceId: string) {
  const admin = createAdminClient()

  const { data: change, error: changeError } = await admin
    .from("stripe_subscription_changes")
    .select(
      "id, organization_id, stripe_subscription_id, stripe_invoice_id, from_plan_id, to_plan_id, change_type, status",
    )
    .eq("stripe_invoice_id", invoiceId)
    .eq("change_type", "upgrade")
    .maybeSingle()

  if (changeError) {
    throw changeError
  }

  if (!change) {
    return
  }

  if (change.status === "completed") {
    return
  }

  if (change.status !== "pending" && change.status !== "awaiting_payment") {
    return
  }

  if (change.from_plan_id !== "starter" || change.to_plan_id !== "pro") {
    throw new Error("Unexpected upgrade direction")
  }

  const { data: billing, error: billingError } = await admin
    .from("organization_subscriptions")
    .select("plan_id, stripe_customer_id, stripe_subscription_id")
    .eq("organization_id", change.organization_id)
    .single()

  if (billingError || !billing) {
    throw new Error("Unable to load organization billing")
  }

  if (
    billing.plan_id !== "starter" ||
    billing.stripe_subscription_id !== change.stripe_subscription_id ||
    !billing.stripe_customer_id
  ) {
    throw new Error("Upgrade subscription mismatch")
  }

  const invoice = await stripe.invoices.retrieve(invoiceId)

  if (invoice.status !== "paid") {
    return
  }

  const invoiceCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id

  if (invoiceCustomerId !== billing.stripe_customer_id) {
    throw new Error("Upgrade invoice customer mismatch")
  }

  if (invoice.billing_reason !== "subscription_update") {
    throw new Error("Unexpected upgrade invoice type")
  }

  // Stripe's newer API versions represent the invoice's
  // subscription under parent.subscription_details.
  const subscriptionDetails = invoice.parent?.subscription_details

  const invoiceSubscriptionId =
    typeof subscriptionDetails?.subscription === "string"
      ? subscriptionDetails.subscription
      : subscriptionDetails?.subscription?.id

  if (invoiceSubscriptionId !== change.stripe_subscription_id) {
    throw new Error(
      "Upgrade invoice does not belong to the expected subscription",
    )
  }

  const subscription = await stripe.subscriptions.retrieve(
    change.stripe_subscription_id,
  )

  const subscriptionCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  if (
    subscriptionCustomerId !== billing.stripe_customer_id ||
    subscription.status !== "active" ||
    subscription.items.data.length !== 1 ||
    subscription.items.data[0].price.id !== STRIPE_PLANS.pro.priceId
  ) {
    // The pending update has not yet been applied.
    // Retry when Stripe confirms the new subscription state.
    return
  }

  const { error: completionError } = await admin.rpc(
    "complete_stripe_subscription_upgrade",
    {
      p_change_id: change.id,
      p_customer_id: billing.stripe_customer_id,
      p_subscription_id: subscription.id,
      p_invoice_id: invoice.id,
      p_price_id: STRIPE_PLANS.pro.priceId,
    },
  )

  if (completionError) {
    throw completionError
  }
}
