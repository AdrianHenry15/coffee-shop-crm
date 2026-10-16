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

  if (changeError) throw changeError

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

  let invoiceId = change.stripe_invoice_id

  if (!invoiceId) {
    const invoices = await stripe.invoices.list({
      customer: billing.stripe_customer_id,
      limit: 100,
    })

    const matches = invoices.data.filter((invoice) => {
      const invoiceSubscription =
        invoice.parent?.subscription_details?.subscription

      const invoiceSubscriptionId =
        typeof invoiceSubscription === "string"
          ? invoiceSubscription
          : invoiceSubscription?.id

      return (
        invoice.metadata?.coffeeshop_upgrade_change_id === change.id &&
        invoice.metadata?.coffeeshop_organization_id ===
          change.organization_id &&
        (typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id) === billing.stripe_customer_id &&
        invoice.billing_reason === "subscription_update" &&
        invoiceSubscriptionId === subscriptionId
      )
    })

    if (matches.length !== 1) {
      return { status: "manual_review" }
    }

    invoiceId = matches[0].id

    const { data: updated, error: updateError } = await admin
      .from("stripe_subscription_changes")
      .update({
        stripe_invoice_id: invoiceId,
        status: "awaiting_payment",
        updated_at: new Date().toISOString(),
      })
      .eq("id", change.id)
      .eq("status", "pending")
      .is("stripe_invoice_id", null)
      .select("id")
      .maybeSingle()

    if (updateError) throw updateError

    if (!updated) {
      return { status: "manual_review" }
    }
  }

  await verifyAndCompleteUpgrade(invoiceId)

  const { data: refreshed, error: refreshError } = await admin
    .from("stripe_subscription_changes")
    .select("status")
    .eq("id", change.id)
    .single()

  if (refreshError || !refreshed) {
    throw new Error("Unable to refresh upgrade status")
  }

  if (refreshed.status === "completed") {
    return { status: "completed" }
  }

  if (refreshed.status === "awaiting_payment") {
    return { status: "awaiting_payment" }
  }

  return { status: "pending" }
}
