"use server"

import { recoverUpgrade } from "@/app/lib/stripe/recover-upgrade"
import { verifyAndCompleteUpgrade } from "@/app/lib/stripe/verify-upgrade"
import { createClient } from "@/app/lib/supabase/server"
import { createAdminClient } from "@/app/lib/supabase/admin"
import { stripe } from "@/app/lib/stripe/server"
import { STRIPE_PLANS } from "@/app/lib/stripe/plans"
import { getOrganization } from "@/lib/organizations"
import { getUpgradePayment } from "@/app/lib/stripe/upgrade-payment"

export async function upgradeToPro(slug: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("Authentication required")
  }

  const organization = await getOrganization(slug)

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single()

  if (membershipError || membership?.role !== "owner") {
    throw new Error("Only organization owners can change plans")
  }

  const admin = createAdminClient()

  const { data: billing, error: billingError } = await admin
    .from("organization_subscriptions")
    .select(
      "plan_id, stripe_customer_id, stripe_subscription_id, stripe_subscription_status",
    )
    .eq("organization_id", organization.id)
    .single()

  if (billingError || !billing) {
    throw new Error("Unable to load billing information")
  }

  if (
    billing.plan_id !== "starter" ||
    billing.stripe_subscription_status !== "active" ||
    !billing.stripe_customer_id ||
    !billing.stripe_subscription_id
  ) {
    throw new Error("An active Starter subscription is required")
  }

  const { data: existingChange, error: changeError } = await admin
    .from("stripe_subscription_changes")
    .select(
      "id, change_type, status, stripe_subscription_id, stripe_invoice_id",
    )
    .eq("organization_id", organization.id)
    .in("status", ["pending", "awaiting_payment", "scheduled"])
    .maybeSingle()

  if (changeError) {
    throw changeError
  }

  if (existingChange) {
    if (
      existingChange.change_type !== "upgrade" ||
      existingChange.status === "scheduled"
    ) {
      throw new Error("A different subscription change is in progress")
    }

    if (
      existingChange.stripe_subscription_id !== billing.stripe_subscription_id
    ) {
      throw new Error("Pending upgrade subscription mismatch")
    }

    const recovery = await recoverUpgrade(existingChange.stripe_subscription_id)

    if (recovery.status === "manual_review") {
      throw new Error("Your upgrade is being verified. Please contact support.")
    }

    if (recovery.status === "completed") {
      return {
        changeId: existingChange.id,
        invoiceId: existingChange.stripe_invoice_id,
        invoiceStatus: "paid",
        paymentStatus: "paid",
        paymentUrl: null,
      }
    }

    if (!existingChange.stripe_invoice_id) {
      throw new Error(
        "Your upgrade is pending verification. Please contact support.",
      )
    }

    const payment = await getUpgradePayment(existingChange.id)

    return {
      changeId: existingChange.id,
      invoiceId: existingChange.stripe_invoice_id,
      invoiceStatus: null,
      paymentStatus: payment.status,
      paymentUrl: payment.paymentUrl,
    }
  }

  const subscription = await stripe.subscriptions.retrieve(
    billing.stripe_subscription_id,
  )

  if (subscription.cancel_at_period_end || subscription.cancel_at) {
    throw new Error(
      "This subscription is scheduled to cancel. Resume it in Manage Billing before upgrading.",
    )
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  if (customerId !== billing.stripe_customer_id) {
    throw new Error("Stripe customer mismatch")
  }

  if (
    subscription.status !== "active" ||
    subscription.items.data.length !== 1 ||
    subscription.items.data[0].price.id !== STRIPE_PLANS.starter.priceId
  ) {
    throw new Error("Stripe subscription is not eligible for upgrade")
  }

  if (subscription.pending_update) {
    throw new Error("Stripe already has a pending subscription update")
  }

  const { data: change, error: insertError } = await admin
    .from("stripe_subscription_changes")
    .insert({
      organization_id: organization.id,
      stripe_subscription_id: subscription.id,
      from_plan_id: "starter",
      to_plan_id: "pro",
      change_type: "upgrade",
      status: "pending",
    })
    .select("id")
    .single()

  if (insertError || !change) {
    throw new Error("Unable to reserve subscription upgrade")
  }

  try {
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: STRIPE_PLANS.pro.priceId,
          },
        ],
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
        metadata: {
          ...subscription.metadata,
          coffeeshop_upgrade_change_id: change.id,
        },
        expand: ["latest_invoice"],
      },
      {
        idempotencyKey: `upgrade-${change.id}`,
      },
    )

    const latestInvoice = updatedSubscription.latest_invoice

    if (!latestInvoice || typeof latestInvoice === "string") {
      throw new Error("Stripe did not return an expanded upgrade invoice")
    }

    if (latestInvoice.billing_reason !== "subscription_update") {
      throw new Error("Unexpected invoice type for subscription upgrade")
    }

    await stripe.invoices.update(latestInvoice.id, {
      metadata: {
        coffeeshop_upgrade_change_id: change.id,
        coffeeshop_organization_id: organization.id,
      },
    })

    if (
      process.env.NODE_ENV === "development" &&
      process.env.TEST_UPGRADE_INTERRUPTION === "true"
    ) {
      console.warn("[TEST] Simulating interrupted upgrade", {
        changeId: change.id,
        invoiceId: latestInvoice.id,
      })

      throw new Error("Simulated interruption before invoice association")
    }

    const { data: updatedChange, error: updateError } = await admin
      .from("stripe_subscription_changes")
      .update({
        stripe_invoice_id: latestInvoice.id,
        status: "awaiting_payment",
        updated_at: new Date().toISOString(),
      })
      .eq("id", change.id)
      .eq("status", "pending")
      .select("id")
      .single()

    if (updateError || !updatedChange) {
      throw new Error("Unable to associate upgrade invoice")
    }

    await verifyAndCompleteUpgrade(latestInvoice.id)

    const payment = await getUpgradePayment(change.id)

    return {
      changeId: change.id,
      invoiceId: latestInvoice.id,
      invoiceStatus: latestInvoice.status,
      paymentStatus: payment.status,
      paymentUrl: payment.paymentUrl,
    }
  } catch (error) {
    console.error("Stripe upgrade request failed:", error)

    throw new Error("Upgrade is pending verification. Please contact support.")
  }
}
