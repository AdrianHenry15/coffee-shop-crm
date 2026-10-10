"use server"

import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createEstimate(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const customerId = String(formData.get("customerId") ?? "")
  const notes = String(formData.get("notes") ?? "").trim()

  const rawItems = String(formData.get("items") ?? "")

  let items: unknown

  try {
    items = JSON.parse(rawItems)
  } catch {
    throw new Error("Invalid estimate items.")
  }

  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new Error("An estimate requires 1–100 items.")
  }

  for (const item of items) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.description !== "string" ||
      !item.description.trim() ||
      item.description.length > 500 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isSafeInteger(item.unitPriceCents) ||
      item.unitPriceCents < 0
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

  const { data: estimateId, error } = await supabase.rpc("create_estimate", {
    p_organization_id: organization.id,
    p_customer_id: customerId,
    p_notes: notes,
    p_items: items,
  })

  if (error || !estimateId) {
    throw new Error(error?.message ?? "Unable to create estimate.")
  }

  revalidatePath(`/org/${slug}/estimates`)

  redirect(`/org/${slug}/estimates/${estimateId}`)
}

type EstimateStatus = "draft" | "sent" | "accepted" | "declined"

const validStatuses: EstimateStatus[] = [
  "draft",
  "sent",
  "accepted",
  "declined",
]

async function getEstimate(slug: string, estimateId: string) {
  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    throw new Error("Unauthorized.")
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single()

  if (orgError || !organization) {
    throw new Error("Organization not found.")
  }

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id, status")
    .eq("id", estimateId)
    .eq("organization_id", organization.id)
    .single()

  if (estimateError || !estimate) {
    throw new Error("Estimate not found.")
  }

  return { supabase, organization, estimate }
}

export async function updateEstimateStatus(
  slug: string,
  estimateId: string,
  status: EstimateStatus,
) {
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid estimate status.")
  }

  const { supabase, organization } = await getEstimate(slug, estimateId)

  const { error } = await supabase
    .from("estimates")
    .update({ status })
    .eq("id", estimateId)
    .eq("organization_id", organization.id)

  if (error) {
    throw new Error("Unable to update estimate status.")
  }

  revalidatePath(`/org/${slug}/estimates`)
  revalidatePath(`/org/${slug}/estimates/${estimateId}`)
}

export async function updateEstimateNotes(
  slug: string,
  estimateId: string,
  notes: string,
) {
  const { supabase, organization } = await getEstimate(slug, estimateId)

  const { error } = await supabase
    .from("estimates")
    .update({ notes: notes.trim() || null })
    .eq("id", estimateId)
    .eq("organization_id", organization.id)

  if (error) {
    throw new Error("Unable to update estimate notes.")
  }

  revalidatePath(`/org/${slug}/estimates`)
  revalidatePath(`/org/${slug}/estimates/${estimateId}`)
}

export async function deleteEstimate(slug: string, estimateId: string) {
  const { supabase, organization } = await getEstimate(slug, estimateId)

  const { error } = await supabase
    .from("estimates")
    .delete()
    .eq("id", estimateId)
    .eq("organization_id", organization.id)

  if (error) {
    console.error("Delete estimate error:", error)
    throw new Error(error.message)
  }

  revalidatePath(`/org/${slug}/estimates`)
  redirect(`/org/${slug}/estimates`)
}

export async function updateEstimateItems(
  slug: string,
  estimateId: string,
  items: {
    description: string
    quantity: number
    unitPriceCents: number
  }[],
) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
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
      item.unitPriceCents < 0
    ) {
      throw new Error("Invalid estimate item.")
    }
  }

  const { supabase, organization, estimate } = await getEstimate(
    slug,
    estimateId,
  )

  if (estimate.status !== "draft") {
    throw new Error("Only draft estimates can be edited.")
  }

  const { error } = await supabase.rpc("update_estimate_items", {
    p_organization_id: organization.id,
    p_estimate_id: estimateId,
    p_items: items,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/org/${slug}/estimates`)
  revalidatePath(`/org/${slug}/estimates/${estimateId}`)
}
