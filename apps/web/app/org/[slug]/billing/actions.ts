"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { createAdminClient } from "@/app/lib/supabase/admin"
import { stripe } from "@/app/lib/stripe/server"
import { STRIPE_PLANS, type PaidPlan } from "@/app/lib/stripe/plans"
import { getOrganization } from "@/lib/organizations"

export async function createCheckoutSession(slug: string, plan: PaidPlan) {
  if (plan !== "starter" && plan !== "pro") {
    throw new Error("Invalid subscription plan")
  }

  const priceId = STRIPE_PLANS[plan].priceId

  if (!priceId) {
    throw new Error("Stripe price is not configured")
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("Authentication required")
  }

  const organization = await getOrganization(slug)

  const { data: membership, error: memberError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single()

  if (memberError || membership?.role !== "owner") {
    throw new Error("Only the organization owner can manage billing")
  }

  const admin = createAdminClient()

  const { data: subscription, error: subscriptionError } = await admin
    .from("organization_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("organization_id", organization.id)
    .single()

  if (subscriptionError || !subscription) {
    throw new Error("Unable to load organization subscription")
  }

  if (subscription.stripe_subscription_id) {
    const existing = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id,
    )

    if (
      existing.status !== "canceled" &&
      existing.status !== "incomplete_expired"
    ) {
      throw new Error(
        "An existing subscription must be managed through billing",
      )
    }
  }

  let customerId = subscription.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: user.email,
        name: organization.name,
        metadata: {
          organization_id: organization.id,
        },
      },
      {
        idempotencyKey: `coffeeshopcrm-customer-${organization.id}`,
      },
    )

    const { error: updateError } = await admin
      .from("organization_subscriptions")
      .update({ stripe_customer_id: customer.id })
      .eq("organization_id", organization.id)
      .is("stripe_customer_id", null)

    if (updateError) {
      throw new Error("Unable to associate Stripe customer")
    }

    const { data: saved, error: readError } = await admin
      .from("organization_subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organization.id)
      .single()

    if (readError || !saved?.stripe_customer_id) {
      throw new Error("Unable to verify Stripe customer")
    }

    customerId = saved.stripe_customer_id
  }

  // Prevent duplicate live subscriptions.
  const existingSubscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  })

  if (
    existingSubscriptions.has_more ||
    existingSubscriptions.data.some(
      (item) =>
        item.status !== "canceled" && item.status !== "incomplete_expired",
    )
  ) {
    throw new Error("An existing Stripe subscription must be resolved")
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (!siteUrl) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL")
  }

  // Check for an existing pending Checkout reservation.
  const { data: pending, error: pendingError } = await admin
    .from("stripe_checkout_reservations")
    .select("id, plan_id, stripe_session_id, created_at")
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .maybeSingle()

  if (pendingError) {
    throw new Error("Unable to check Checkout reservations")
  }

  if (pending) {
    if (pending.stripe_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        pending.stripe_session_id,
      )

      if (existingSession.status === "open") {
        if (pending.plan_id === plan) {
          if (!existingSession.url) {
            throw new Error("Existing Checkout URL unavailable")
          }

          // Reuse the session only when it matches the selected plan.
          redirect(existingSession.url)
        }

        // The user selected a different plan. Expire this open
        // session and release its reservation before creating another.
        await stripe.checkout.sessions.expire(existingSession.id)

        const { data: released, error: releaseError } = await admin
          .from("stripe_checkout_reservations")
          .update({
            status: "expired",
            updated_at: new Date().toISOString(),
          })
          .eq("id", pending.id)
          .eq("status", "pending")
          .eq("stripe_session_id", existingSession.id)
          .select("id")
          .single()

        if (releaseError || !released) {
          throw new Error("Unable to replace the pending Checkout session")
        }
      }

      if (existingSession.status === "complete") {
        throw new Error(
          "Checkout has completed. Waiting for billing confirmation.",
        )
      }

      // Stripe has expired the session; release the reservation.
      if (existingSession.status === "expired") {
        const { error: releaseError } = await admin
          .from("stripe_checkout_reservations")
          .update({
            status: "expired",
            updated_at: new Date().toISOString(),
          })
          .eq("id", pending.id)
          .eq("status", "pending")

        if (releaseError) {
          throw new Error("Unable to release expired Checkout")
        }
      }
    } else {
      // A reservation without a Stripe session may indicate an
      // interrupted Checkout creation. Don't release it immediately:
      // another request may still be creating the Stripe session.
      const age = Date.now() - new Date(pending.created_at).getTime()
      const recoveryDelay = 10 * 60 * 1000

      if (age < recoveryDelay) {
        throw new Error("Checkout is being prepared. Please try again shortly.")
      }

      const { error: releaseError } = await admin
        .from("stripe_checkout_reservations")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pending.id)
        .eq("status", "pending")
        .is("stripe_session_id", null)

      if (releaseError) {
        throw new Error("Unable to recover interrupted Checkout")
      }
    }
  }

  // Reserve Checkout before contacting Stripe.
  const { data: reservation, error: reservationError } = await admin
    .from("stripe_checkout_reservations")
    .insert({
      organization_id: organization.id,
      plan_id: plan,
      status: "pending",
    })
    .select("id")
    .single()

  if (reservationError || !reservation) {
    throw new Error(
      "A Checkout session may already be pending for this organization",
    )
  }

  let sessionId: string | null = null
  let checkoutUrl: string | null = null

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: organization.id,
        metadata: {
          reservation_id: reservation.id,
        },
        subscription_data: {
          metadata: {
            organization_id: organization.id,
            plan_id: plan,
          },
        },
        success_url: `${siteUrl}/org/${slug}/billing?checkout=success`,
        cancel_url: `${siteUrl}/org/${slug}/billing?checkout=cancel`,
      },
      {
        idempotencyKey: `checkout-${reservation.id}`,
      },
    )

    sessionId = session.id

    if (!session.url) {
      throw new Error("Unable to create Stripe Checkout session")
    }

    const { data: saved, error: saveError } = await admin
      .from("stripe_checkout_reservations")
      .update({
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservation.id)
      .eq("status", "pending")
      .select("id")
      .single()

    if (saveError || !saved) {
      throw new Error("Unable to save Stripe Checkout session")
    }

    checkoutUrl = session.url
  } catch (error) {
    if (sessionId) {
      try {
        await stripe.checkout.sessions.expire(sessionId)
      } catch (expireError) {
        console.error("Unable to expire Stripe session:", expireError)
      }
    }

    const { error: releaseError } = await admin
      .from("stripe_checkout_reservations")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservation.id)
      .eq("status", "pending")

    if (releaseError) {
      console.error("Unable to release Checkout reservation:", releaseError)
    }

    throw error
  }

  if (!checkoutUrl) {
    throw new Error("Checkout URL unavailable")
  }

  redirect(checkoutUrl)
}
