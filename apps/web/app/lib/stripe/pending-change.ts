import "server-only"

import { createAdminClient } from "@/app/lib/supabase/admin"

export async function getOpenSubscriptionChange(organizationId: string) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("stripe_subscription_changes")
    .select(
      "id, organization_id, stripe_subscription_id, from_plan_id, to_plan_id, change_type, status, stripe_invoice_id, stripe_schedule_id, effective_at, created_at",
    )
    .eq("organization_id", organizationId)
    .in("status", ["pending", "awaiting_payment", "scheduled"])
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load subscription change: ${error.message}`)
  }

  return data
}
