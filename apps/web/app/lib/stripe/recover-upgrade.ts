import "server-only"

import { createAdminClient } from "@/app/lib/supabase/admin"
import { stripe } from "@/app/lib/stripe/server"
import { verifyAndCompleteUpgrade } from "./verify-upgrade"

export type UpgradeRecoveryResult =
  | { status: "not_found" }
  | { status: "completed" }
  | { status: "pending" }
  | { status: "awaiting_payment" }
  | { status: "manual_review" }

export async function recoverUpgrade(
  subscriptionId: string,
): Promise<UpgradeRecoveryResult> {
  const admin = createAdminClient()

  const { data: change, error: changeError } = await admin
    .from("stripe_subscription_changes")
    .select(
      "id, organization_id, stripe_subscription_id, stripe_invoice_id, status",
    )
    .eq("stripe_subscription_id", subscriptionId)
    .eq("change_type", "upgrade")
    .in("status", ["pending", "awaiting_payment"])
    .maybeSingle()

  if (changeError) {
    throw changeError
  }

  if (!change) {
    return { status: "not_found" }
  }

  const { data: billing, error: billingError } = await admin
    .from("organization_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("organization_id", change.organization_id)
    .single()

  if (billingError || !billing) {
    throw new Error("Unable to load organization billing")
  }

  if (
    !billing.stripe_customer_id ||
    billing.stripe_subscription_id !== subscriptionId
  ) {
    throw new Error("Upgrade subscription mismatch")
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  if (customerId !== billing.stripe_customer_id) {
    throw new Error("Stripe customer mismatch")
  }

  if (!change.stripe_invoice_id) {
    // Do not guess which invoice belongs to this request.
    return { status: "manual_review" }
  }

  await verifyAndCompleteUpgrade(change.stripe_invoice_id)

  const { data: updatedChange, error: refreshError } = await admin
    .from("stripe_subscription_changes")
    .select("status")
    .eq("id", change.id)
    .single()

  if (refreshError || !updatedChange) {
    throw new Error("Unable to refresh upgrade status")
  }

  if (updatedChange.status === "completed") {
    return { status: "completed" }
  }

  if (updatedChange.status === "awaiting_payment") {
    return { status: "awaiting_payment" }
  }

  return { status: "pending" }
}
