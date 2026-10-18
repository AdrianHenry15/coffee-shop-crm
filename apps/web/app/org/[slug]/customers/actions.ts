"use server"

import {
  ContactImportResult,
  MAX_CSV_BYTES,
  parseContactCsv,
  validateContactImportRows,
} from "@/app/lib/crm/csv-import"
import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export type CreateCustomerState = {
  success: boolean
  message: string
}

export async function createCustomer(
  _previousState: CreateCustomerState,
  formData: FormData,
): Promise<CreateCustomerState> {
  const slug = String(formData.get("slug") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim()

  if (!name || name.length > 200) {
    return {
      success: false,
      message: "A valid customer name is required.",
    }
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
    return {
      success: false,
      message: "Organization not found.",
    }
  }

  const { error } = await supabase.from("customers").insert({
    organization_id: organization.id,
    name,
    email: email || null,
    phone: phone || null,
    notes: notes || null,
  })

  if (error) {
    console.error("Error creating customer:", error)

    return {
      success: false,
      message: "Unable to create customer.",
    }
  }

  revalidatePath(`/org/${slug}/customers`)
  revalidatePath(`/org/${slug}/dashboard`)

  return {
    success: true,
    message: "Customer created successfully.",
  }
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

  if (error) {
    console.error("Error deleting customer:", error)
    throw new Error(error.message)
  }

  if (!deleted) {
    throw new Error("Customer not found or access denied.")
  }

  revalidatePath(`/org/${slug}/customers`)
  revalidatePath(`/org/${slug}/leads`)
}

export async function importCustomers(
  slug: string,
  csvText: string,
): Promise<ContactImportResult> {
  if (
    typeof csvText !== "string" ||
    new TextEncoder().encode(csvText).byteLength > MAX_CSV_BYTES
  ) {
    return { success: false, imported: 0, message: "CSV file is too large." }
  }

  let rows

  try {
    rows = parseContactCsv(csvText)
  } catch (error) {
    return {
      success: false,
      imported: 0,
      message: error instanceof Error ? error.message : "Invalid CSV file.",
    }
  }

  const validationErrors = validateContactImportRows(rows)

  if (validationErrors.length > 0) {
    return {
      success: false,
      imported: 0,
      message: validationErrors.slice(0, 5).join(" "),
    }
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
    return { success: false, imported: 0, message: "Organization not found." }
  }

  const { error } = await supabase.from("customers").insert(
    rows.map((row) => ({
      organization_id: organization.id,
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      notes: row.notes || null,
    })),
  )

  if (error) {
    console.error("Error importing customers:", error)
    return {
      success: false,
      imported: 0,
      message: "Unable to import customers.",
    }
  }

  revalidatePath(`/org/${slug}/customers`)
  revalidatePath(`/org/${slug}/dashboard`)

  return {
    success: true,
    imported: rows.length,
    message: `Imported ${rows.length} customers.`,
  }
}
