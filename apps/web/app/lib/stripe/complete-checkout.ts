import "server-only"

import { createAdminClient } from "@/app/lib/supabase/admin"
import { stripe } from "@/app/lib/stripe/server"
import { STRIPE_PLANS } from "@/app/lib/stripe/plans"

export async function completeStripeCheckout(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (
    session.mode !== "subscription" ||
    session.status !== "complete" ||
    session.payment_status !== "paid"
  ) {
    throw new Error("Checkout payment is not confirmed")
  }

  const reservationId = session.metadata?.reservation_id
  const organizationId = session.client_reference_id

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id

  if (!reservationId || !organizationId || !subscriptionId || !customerId) {
    throw new Error("Checkout session is missing required identifiers")
  }

  const admin = createAdminClient()

  const { data: reservation, error: reservationError } = await admin
    .from("stripe_checkout_reservations")
    .select(
      "id, organization_id, plan_id, status, stripe_session_id, stripe_subscription_id",
    )
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .eq("stripe_session_id", session.id)
    .single()

  if (reservationError || !reservation) {
    throw new Error("Checkout reservation verification failed")
  }

  if (reservation.status === "completed") {
    if (reservation.stripe_subscription_id !== subscriptionId) {
      throw new Error("Completed reservation subscription mismatch")
    }

    return
  }

  if (reservation.status !== "pending") {
    throw new Error("Checkout reservation is not pending")
  }

  const { data: billing, error: billingError } = await admin
    .from("organization_subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", organizationId)
    .single()

  if (billingError || billing?.stripe_customer_id !== customerId) {
    throw new Error("Stripe customer does not match organization")
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  })

  const actualCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  const actualPriceId = subscription.items.data[0]?.price.id

  const expectedPriceId =
    reservation.plan_id === "starter"
      ? STRIPE_PLANS.starter.priceId
      : reservation.plan_id === "pro"
        ? STRIPE_PLANS.pro.priceId
        : null

  if (
    actualCustomerId !== customerId ||
    !expectedPriceId ||
    actualPriceId !== expectedPriceId ||
    subscription.items.data.length !== 1
  ) {
    throw new Error("Stripe subscription does not match reservation")
  }

  const invoice = subscription.latest_invoice

  if (
    subscription.status !== "active" ||
    !invoice ||
    typeof invoice === "string" ||
    invoice.status !== "paid"
  ) {
    throw new Error("Initial subscription payment is not confirmed")
  }

  const { error: completionError } = await admin.rpc(
    "complete_stripe_checkout",
    {
      p_reservation_id: reservation.id,
      p_session_id: session.id,
      p_customer_id: customerId,
      p_subscription_id: subscriptionId,
      p_price_id: actualPriceId,
      p_plan_id: reservation.plan_id,
      p_status: subscription.status,
    },
  )

  if (completionError) {
    throw new Error(
      `Unable to complete Stripe Checkout: ${completionError.message}`,
    )
  }
}
