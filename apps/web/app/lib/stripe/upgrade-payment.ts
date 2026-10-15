import "server-only"

import { createAdminClient } from "@/app/lib/supabase/admin"
import { stripe } from "@/app/lib/stripe/server"

export type UpgradePaymentResult =
  | {
      status: "paid"
      paymentUrl: null
    }
  | {
      status: "requires_payment"
      paymentUrl: string
    }
  | {
      status: "processing"
      paymentUrl: null
    }

export async function getUpgradePayment(
  changeId: string,
): Promise<UpgradePaymentResult> {
  const admin = createAdminClient()

  const { data: change, error: changeError } = await admin
    .from("stripe_subscription_changes")
    .select(
      "id, organization_id, stripe_subscription_id, stripe_invoice_id, status",
    )
    .eq("id", changeId)
    .eq("change_type", "upgrade")
    .single()

  if (changeError || !change) {
    throw new Error("Upgrade request not found")
  }

  if (change.status !== "awaiting_payment" && change.status !== "completed") {
    throw new Error("Upgrade is not ready for payment")
  }

  if (!change.stripe_invoice_id) {
    throw new Error("Upgrade invoice is missing")
  }

  const { data: billing, error: billingError } = await admin
    .from("organization_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("organization_id", change.organization_id)
    .single()

  if (billingError || !billing) {
    throw new Error("Unable to load billing information")
  }

  if (
    !billing.stripe_customer_id ||
    billing.stripe_subscription_id !== change.stripe_subscription_id
  ) {
    throw new Error("Upgrade subscription mismatch")
  }

  const invoice = await stripe.invoices.retrieve(change.stripe_invoice_id)

  const invoiceCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id

  const invoiceSubscription = invoice.parent?.subscription_details?.subscription

  const invoiceSubscriptionId =
    typeof invoiceSubscription === "string"
      ? invoiceSubscription
      : invoiceSubscription?.id

  if (
    invoiceCustomerId !== billing.stripe_customer_id ||
    invoiceSubscriptionId !== change.stripe_subscription_id ||
    invoice.billing_reason !== "subscription_update"
  ) {
    throw new Error("Upgrade invoice verification failed")
  }

  if (invoice.status === "paid") {
    return {
      status: "paid",
      paymentUrl: null,
    }
  }

  if (invoice.status === "open" && invoice.hosted_invoice_url) {
    return {
      status: "requires_payment",
      paymentUrl: invoice.hosted_invoice_url,
    }
  }

  return {
    status: "processing",
    paymentUrl: null,
  }
}
