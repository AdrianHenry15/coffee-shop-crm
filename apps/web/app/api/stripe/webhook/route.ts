import { NextResponse } from "next/server"
import { stripe } from "@/app/lib/stripe/server"
import { createAdminClient } from "@/app/lib/supabase/admin"
import { STRIPE_PLANS } from "@/app/lib/stripe/plans"
import { syncStripeSubscription } from "@/app/lib/stripe/sync-subscription"
import { verifyAndCompleteUpgrade } from "@/app/lib/stripe/verify-upgrade"
import { recoverUpgrade } from "@/app/lib/stripe/recover-upgrade"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook configuration missing" },
      { status: 400 },
    )
  }

  const payload = await request.text()

  let event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object

        if (session.mode !== "subscription") {
          break
        }

        const checkoutCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id

        if (!checkoutCustomerId) {
          throw new Error("Subscription Checkout is missing its customer")
        }

        const scopeAdmin = createAdminClient()

        const { data: crmBilling, error: scopeError } = await scopeAdmin
          .from("organization_subscriptions")
          .select("organization_id")
          .eq("stripe_customer_id", checkoutCustomerId)
          .maybeSingle()

        if (scopeError) {
          throw scopeError
        }

        // Other TGS applications share this Stripe account.
        if (!crmBilling) {
          break
        }

        if (session.payment_status !== "paid") {
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

        if (
          !reservationId ||
          !organizationId ||
          !subscriptionId ||
          !customerId
        ) {
          throw new Error("Checkout session is missing required identifiers")
        }

        const admin = createAdminClient()

        // Verify this exact Checkout session and reservation.
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

        // Stripe can deliver the same event multiple times.
        if (reservation.status === "completed") {
          if (reservation.stripe_subscription_id !== subscriptionId) {
            throw new Error("Completed reservation subscription mismatch")
          }

          break
        }

        if (reservation.status !== "pending") {
          throw new Error("Checkout reservation is not pending")
        }

        // Verify the Stripe customer belongs to this organization.
        const { data: organizationSubscription, error: customerError } =
          await admin
            .from("organization_subscriptions")
            .select("stripe_customer_id")
            .eq("organization_id", organizationId)
            .single()

        if (
          customerError ||
          organizationSubscription?.stripe_customer_id !== customerId
        ) {
          throw new Error("Stripe customer does not match organization")
        }

        // Retrieve the subscription directly from Stripe.
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          {
            expand: ["latest_invoice"],
          },
        )

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

        // Confirm the initial subscription payment.
        const initialInvoice = subscription.latest_invoice

        const paymentConfirmed =
          subscription.status === "active" &&
          initialInvoice !== null &&
          typeof initialInvoice !== "string" &&
          initialInvoice.status === "paid"

        if (!paymentConfirmed) {
          throw new Error("Initial subscription payment is not confirmed")
        }

        // Activate entitlements and complete the reservation
        // atomically through PostgreSQL.
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

        break
      }

      case "checkout.session.expired": {
        const session = event.data.object
        const reservationId = session.metadata?.reservation_id

        if (!reservationId) {
          break
        }

        const admin = createAdminClient()

        // Release only the reservation associated with this session.
        const { error } = await admin
          .from("stripe_checkout_reservations")
          .update({
            status: "expired",
            updated_at: new Date().toISOString(),
          })
          .eq("id", reservationId)
          .eq("stripe_session_id", session.id)
          .eq("status", "pending")

        if (error) {
          throw new Error(
            `Unable to expire Checkout reservation: ${error.message}`,
          )
        }

        break
      }

      case "customer.subscription.created": {
        // Initial activation must come from verified Checkout.
        break
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id

        const admin = createAdminClient()

        const { data: trackedSubscription, error: lookupError } = await admin
          .from("organization_subscriptions")
          .select("organization_id")
          .eq("stripe_customer_id", customerId)
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle()

        if (lookupError) {
          throw lookupError
        }

        if (!trackedSubscription) {
          break
        }

        await syncStripeSubscription(subscription.id)

        if (event.type === "customer.subscription.updated") {
          await recoverUpgrade(subscription.id)
        }

        break
      }

      case "invoice.payment_failed": {
        const eventInvoice = event.data.object
        const invoice = await stripe.invoices.retrieve(eventInvoice.id)
        const linkedSubscription =
          invoice.parent?.subscription_details?.subscription

        const subscriptionId =
          typeof linkedSubscription === "string"
            ? linkedSubscription
            : linkedSubscription?.id

        if (subscriptionId) {
          await syncStripeSubscription(subscriptionId)
        }

        console.info("Stripe invoice payment failed:", event.id)
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object

        await verifyAndCompleteUpgrade(invoice.id)

        break
      }

      default:
        break
    }
  } catch (error) {
    console.error("Stripe webhook processing failed:", error)

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    )
  }

  return NextResponse.json({ received: true })
}
