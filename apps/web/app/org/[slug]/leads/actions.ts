"use server"

import {
  ContactImportResult,
  ContactImportRow,
  MAX_CSV_BYTES,
  parseContactCsv,
  validateContactImportRows,
} from "@/app/lib/crm/csv-import"
import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export type CreateLeadState = {
  success: boolean
  message: string
}

export async function createLead(
  _previousState: CreateLeadState,
  formData: FormData,
): Promise<CreateLeadState> {
  const slug = String(formData.get("slug") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim()

  if (!name || name.length > 200) {
    return {
      success: false,
      message: "A valid lead name is required.",
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

  const { error } = await supabase.from("leads").insert({
    organization_id: organization.id,
    name,
    email: email || null,
    phone: phone || null,
    notes: notes || null,
  })

  if (error) {
    console.error("Error creating lead:", error)

    return {
      success: false,
      message: "Unable to create lead.",
    }
  }

  revalidatePath(`/org/${slug}/leads`)
  revalidatePath(`/org/${slug}/dashboard`)

  return {
    success: true,
    message: "Lead created successfully.",
  }
}

export async function updateLead(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const id = String(formData.get("id") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim()
  const status = String(formData.get("status") ?? "")

  const validStatuses = ["new", "contacted", "qualified", "lost"]

  if (!name || name.length > 200) {
    throw new Error("A valid lead name is required.")
  }

  if (!validStatuses.includes(status)) {
    throw new Error("Invalid lead status.")
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
    .from("leads")
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
    throw new Error("Unable to update lead.")
  }

  revalidatePath(`/org/${slug}/leads`)
}

export async function deleteLead(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const id = String(formData.get("id") ?? "")

  if (!slug || !id) {
    throw new Error("Missing lead information.")
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

  const { data: deleted, error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.id)
    .select("id")
    .single()

  if (error) {
    console.error("Error deleting lead:", error)
    throw new Error(error.message)
  }

  if (!deleted) {
    throw new Error("Lead not found or access denied.")
  }

  revalidatePath(`/org/${slug}/leads`)
  revalidatePath(`/org/${slug}/customers`)
}

export async function convertLead(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const leadId = String(formData.get("leadId") ?? "")

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

  // Ensure this lead belongs to the current workspace.
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("organization_id", organization.id)
    .single()

  if (leadError || !lead) {
    throw new Error("Lead not found.")
  }

  const { error } = await supabase.rpc("convert_lead_to_customer", {
    lead_uuid: lead.id,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/org/${slug}/leads`)
  revalidatePath(`/org/${slug}/customers`)

  redirect(`/org/${slug}/customers?success=converted`)
}

export async function importLeads(
  slug: string,
  csvText: string,
): Promise<ContactImportResult> {
  if (typeof csvText !== "string") {
    return { success: false, imported: 0, message: "Invalid CSV file." }
  }

  if (new TextEncoder().encode(csvText).byteLength > MAX_CSV_BYTES) {
    return { success: false, imported: 0, message: "CSV file is too large." }
  }

  let rows: ContactImportRow[]

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

  const { error } = await supabase.from("leads").insert(
    rows.map((row) => ({
      organization_id: organization.id,
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      notes: row.notes || null,
    })),
  )

  if (error) {
    console.error("Error importing leads:", error)
    return { success: false, imported: 0, message: "Unable to import leads." }
  }

  revalidatePath(`/org/${slug}/leads`)
  revalidatePath(`/org/${slug}/dashboard`)

  return {
    success: true,
    imported: rows.length,
    message: `Imported ${rows.length} leads.`,
  }
}
