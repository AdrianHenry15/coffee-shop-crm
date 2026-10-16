"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/app/lib/supabase/server"
import { createAdminClient } from "@/app/lib/supabase/admin"
import { completeStripeCheckout } from "@/app/lib/stripe/complete-checkout"
import { getOrganization } from "@/lib/organizations"

export async function recoverCheckout(slug: string) {
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
    throw new Error("Only organization owners can recover billing")
  }

  const admin = createAdminClient()

  const { data: reservation, error: reservationError } = await admin
    .from("stripe_checkout_reservations")
    .select("stripe_session_id")
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .not("stripe_session_id", "is", null)
    .maybeSingle()

  if (reservationError) {
    throw new Error("Unable to find pending Checkout")
  }

  if (!reservation?.stripe_session_id) {
    throw new Error("No pending Checkout session found")
  }

  await completeStripeCheckout(reservation.stripe_session_id)

  revalidatePath(`/org/${slug}/billing`)

  return { success: true }
}
