"use server"

import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createCustomerActivity(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const customerId = String(formData.get("customerId") ?? "")
  const type = String(formData.get("type") ?? "")
  const content = String(formData.get("content") ?? "").trim()

  if (!["note", "call", "email"].includes(type)) {
    throw new Error("Invalid activity type.")
  }

  if (!content || content.length > 5000) {
    throw new Error("Activity must contain between 1 and 5000 characters.")
  }

  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
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

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("organization_id", organization.id)
    .single()

  if (customerError || !customer) {
    throw new Error("Customer not found.")
  }

  const { error } = await supabase.from("customer_activities").insert({
    organization_id: organization.id,
    customer_id: customer.id,
    created_by: userData.user.id,
    type,
    content,
  })

  if (error) {
    console.error("Unable to create customer activity:", error)
    throw new Error("Unable to create customer activity.")
  }

  revalidatePath(`/org/${slug}/customers/${customerId}`)
}

export async function deleteCustomerActivity(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const customerId = String(formData.get("customerId") ?? "")
  const activityId = String(formData.get("activityId") ?? "")

  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
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

  const { data: deleted, error } = await supabase
    .from("customer_activities")
    .delete()
    .eq("id", activityId)
    .eq("customer_id", customerId)
    .eq("organization_id", organization.id)
    .eq("created_by", userData.user.id)
    .select("id")
    .single()

  if (error || !deleted) {
    throw new Error("Unable to delete activity.")
  }

  revalidatePath(`/org/${slug}/customers/${customerId}`)
}
