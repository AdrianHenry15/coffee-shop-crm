"use server"

import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createCustomer(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim()

  if (!name || name.length > 200) {
    throw new Error("A valid customer name is required.")
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

  const { error } = await supabase.from("customers").insert({
    organization_id: organization.id,
    name,
    email: email || null,
    phone: phone || null,
    notes: notes || null,
  })

  if (error) {
    throw new Error("Unable to create customer.")
  }

  revalidatePath(`/org/${slug}/customers`)
}

export async function updateCustomer(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const id = String(formData.get("id") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim()
  const status = String(formData.get("status") ?? "")

  if (!name || name.length > 200) {
    throw new Error("A valid customer name is required.")
  }

  if (!["active", "inactive"].includes(status)) {
    throw new Error("Invalid customer status.")
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

  const { data: updated, error } = await supabase
    .from("customers")
    .update({
      name,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      status,
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .select("id")
    .single()

  if (error || !updated) {
    throw new Error("Unable to update customer.")
  }

  revalidatePath(`/org/${slug}/customers`)
}

export async function deleteCustomer(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const id = String(formData.get("id") ?? "")

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
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.id)
    .select("id")
    .single()

  if (error || !deleted) {
    throw new Error("Unable to delete customer.")
  }

  revalidatePath(`/org/${slug}/customers`)
  revalidatePath(`/org/${slug}/leads`)
}
