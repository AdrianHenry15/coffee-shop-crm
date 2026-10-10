"use server"

import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

type EstimateItem = {
  description: string
  quantity: number
  unitPriceCents: number
}

export async function createEstimate(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const customerId = String(formData.get("customerId") ?? "")
  const notes = String(formData.get("notes") ?? "").trim()

  const rawItems = String(formData.get("items") ?? "")

  let items: EstimateItem[]

  try {
    items = JSON.parse(rawItems)
  } catch {
    throw new Error("Invalid estimate items.")
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new Error("An estimate requires 1–100 items.")
  }

  for (const item of items) {
    if (
      typeof item.description !== "string" ||
      !item.description.trim() ||
      item.description.length > 500 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isSafeInteger(item.unitPriceCents) ||
      item.unitPriceCents < 0 ||
      !Number.isSafeInteger(item.quantity * item.unitPriceCents)
    ) {
      throw new Error("Invalid estimate item.")
    }
  }

  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    redirect("/login")
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single()

  if (orgError || !organization) {
    throw new Error("Organization not found.")
  }

  // Verify customer belongs to this organization.
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("organization_id", organization.id)
    .single()

  if (customerError || !customer) {
    throw new Error("Customer not found.")
  }

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      organization_id: organization.id,
      customer_id: customer.id,
      notes: notes || null,
      status: "draft",
    })
    .select("id")
    .single()

  if (estimateError || !estimate) {
    throw new Error("Unable to create estimate.")
  }

  const { error: itemsError } = await supabase.from("estimate_items").insert(
    items.map((item, index) => ({
      organization_id: organization.id,
      estimate_id: estimate.id,
      position: index,
      description: item.description.trim(),
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
    })),
  )

  if (itemsError) {
    // Best-effort cleanup. This is not a transaction.
    await supabase
      .from("estimates")
      .delete()
      .eq("id", estimate.id)
      .eq("organization_id", organization.id)

    throw new Error("Unable to save estimate items.")
  }

  revalidatePath(`/org/${slug}/estimates`)
  redirect(`/org/${slug}/estimates`)
}
