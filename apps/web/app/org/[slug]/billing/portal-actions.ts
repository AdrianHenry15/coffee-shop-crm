"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { createAdminClient } from "@/app/lib/supabase/admin"
import { stripe } from "@/app/lib/stripe/server"
import { getOrganization } from "@/lib/organizations"

export async function createBillingPortalSession(slug: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("Authentication required")
  }

  const organization = await getOrganization(slug)

  // Only organization owners can manage billing.
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
    .select("stripe_customer_id")
    .eq("organization_id", organization.id)
    .single()

  if (subscriptionError || !subscription) {
    throw new Error("Unable to load organization subscription")
  }

  if (!subscription.stripe_customer_id) {
    throw new Error("This organization does not have a billing account yet")
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (!siteUrl) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL")
  }

  // Stripe hosts the secure payment-management interface.
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${siteUrl}/org/${slug}/billing`,
  })

  redirect(portalSession.url)
}
