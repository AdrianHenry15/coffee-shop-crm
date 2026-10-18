import "server-only"

import {
  MAX_CSV_BYTES,
  parseContactCsv,
  validateContactImportRows,
  type ContactImportResult,
} from "@/app/lib/crm/csv-import"
import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function importContactCsv(
  slug: string,
  csvText: string,
  entity: "leads" | "customers",
): Promise<ContactImportResult> {
  if (
    typeof csvText !== "string" ||
    new TextEncoder().encode(csvText).byteLength > MAX_CSV_BYTES
  ) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      issues: [],
      message: "Choose a CSV file smaller than 700 KB.",
    }
  }

  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    redirect("/login")
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single()

  if (organizationError || !organization) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      issues: [],
      message: "Organization not found.",
    }
  }

  let rows: ReturnType<typeof parseContactCsv>

  try {
    rows = parseContactCsv(csvText)
  } catch (error) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      issues: [],
      message: error instanceof Error ? error.message : "Invalid CSV file.",
    }
  }

  const { validRows, issues } = validateContactImportRows(rows)
  const invalidCount = rows.length - validRows.length

  if (validRows.length === 0) {
    return {
      success: false,
      imported: 0,
      skipped: invalidCount,
      issues,
      message: `No valid ${entity} found. Nothing was imported.`,
    }
  }

  const { data: capacity, error: capacityError } = await supabase
    .rpc("get_contact_import_capacity", {
      p_organization_id: organization.id,
      p_resource: entity,
    })
    .single()

  if (capacityError || !capacity) {
    console.error("Unable to check contact capacity:", capacityError)

    return {
      success: false,
      imported: 0,
      skipped: rows.length,
      issues,
      message:
        "Unable to check your subscription allowance. Nothing was imported.",
    }
  }

  const available = capacity.is_unlimited
    ? validRows.length
    : Math.max(0, Number(capacity.remaining_count ?? 0))

  const rowsToImport = validRows.slice(0, available)
  const limitedCount = validRows.length - rowsToImport.length

  if (rowsToImport.length === 0) {
    return {
      success: false,
      imported: 0,
      skipped: rows.length,
      issues,
      message: `Your ${entity} allowance is full. Remove existing contacts or upgrade your plan before importing.`,
    }
  }

  const { error: insertError } = await supabase.from(entity).insert(
    rowsToImport.map((row) => ({
      organization_id: organization.id,
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      notes: row.notes || null,
    })),
  )

  if (insertError) {
    console.error(`Error importing ${entity}:`, insertError)

    const limitReached = insertError.message.includes(
      "Subscription limit reached",
    )

    return {
      success: false,
      imported: 0,
      skipped: rows.length,
      issues,
      message: limitReached
        ? "Your available allowance changed. Nothing was imported. Try again to use the latest allowance."
        : `Unable to import ${entity}. Nothing was imported.`,
    }
  }

  revalidatePath(`/org/${slug}/${entity}`)
  revalidatePath(`/org/${slug}/dashboard`)

  const messages = [`Imported ${rowsToImport.length} ${entity}.`]

  if (invalidCount > 0) {
    messages.push(`Skipped ${invalidCount} invalid rows.`)
  }

  if (limitedCount > 0) {
    messages.push(
      `Left out ${limitedCount} additional contacts because your subscription allowance was reached.`,
    )
  }

  return {
    success: true,
    imported: rowsToImport.length,
    skipped: invalidCount + limitedCount,
    issues,
    message: messages.join(" "),
  }
}
