"use server"

import { revalidatePath } from "next/cache"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import type {
  CatalogField,
  CreateTemplateResult,
} from "@/app/lib/catalog/types"
import { getCatalogCapacityError } from "@/app/lib/catalog/capacity-errors"

export async function createCatalogTemplate(
  slug: string,
  formData: FormData,
): Promise<CreateTemplateResult> {
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const kind = String(formData.get("kind") ?? "")
  const rawFields = String(formData.get("fields") ?? "")

  if (!name || name.length > 100) {
    return { error: "Enter a template name up to 100 characters." }
  }

  if (description.length > 2000) {
    return { error: "Description must be 2,000 characters or fewer." }
  }

  if (kind !== "product" && kind !== "service") {
    return { error: "Choose Product or Service." }
  }

  if (new TextEncoder().encode(rawFields).byteLength > 65536) {
    return { error: "The template contains too much field data." }
  }

  let fields: CatalogField[]

  try {
    const parsed: unknown = JSON.parse(rawFields)

    if (!Array.isArray(parsed) || parsed.length > 50) {
      return { error: "A template can contain up to 50 custom fields." }
    }

    // PostgreSQL independently validates the complete field structure.
    fields = parsed as CatalogField[]
  } catch {
    return { error: "Invalid template field data." }
  }

  const { organization, supabase, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return {
      error: "Only workspace owners and admins can manage templates.",
    }
  }

  const { data: templateId, error } = await supabase.rpc(
    "create_catalog_template",
    {
      p_organization_id: organization.id,
      p_name: name,
      p_description: description,
      p_kind: kind,
      p_fields: fields,
    },
  )

  if (error || typeof templateId !== "string") {
    console.error("Unable to create catalog template:", error)

    const capacityError = getCatalogCapacityError(error)

    if (capacityError) {
      return { error: capacityError }
    }

    return {
      error:
        error?.code === "23514"
          ? "Check the template fields. Keys must be unique, selection fields need options, and only numeric fields can have units."
          : "Unable to create the template. Please try again.",
    }
  }

  revalidatePath(`/org/${slug}/catalog`)
  revalidatePath(`/org/${slug}/catalog/templates`)

  return { templateId }
}

export async function updateCatalogTemplate(
  slug: string,
  templateId: string,
  expectedVersionId: string,
  formData: FormData,
): Promise<CreateTemplateResult> {
  const { organization, supabase, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return {
      error: "Only workspace owners and admins can manage templates.",
    }
  }

  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const rawFields = String(formData.get("fields") ?? "")

  if (!name || name.length > 100) {
    return { error: "Enter a template name up to 100 characters." }
  }

  if (description.length > 2000) {
    return { error: "Description must be 2,000 characters or fewer." }
  }

  if (new TextEncoder().encode(rawFields).byteLength > 65536) {
    return { error: "The template contains too much field data." }
  }

  let fields: CatalogField[]

  try {
    const parsed: unknown = JSON.parse(rawFields)

    if (!Array.isArray(parsed) || parsed.length > 50) {
      return { error: "A template can contain up to 50 custom fields." }
    }

    fields = parsed as CatalogField[]
  } catch {
    return { error: "Invalid template field data." }
  }

  const { data: savedTemplateId, error } = await supabase.rpc(
    "update_catalog_template",
    {
      p_organization_id: organization.id,
      p_template_id: templateId,
      p_expected_version_id: expectedVersionId,
      p_name: name,
      p_description: description,
      p_fields: fields,
    },
  )

  if (error || typeof savedTemplateId !== "string") {
    console.error("Unable to update catalog template:", error)

    const capacityError = getCatalogCapacityError(error)

    if (capacityError) {
      return { error: capacityError }
    }

    if (error?.code === "40001") {
      return {
        error:
          "Someone updated this template after you opened it. Reload the page before saving.",
      }
    }

    return {
      error:
        "Unable to save the template. Check the field definitions and try again.",
    }
  }

  revalidatePath(`/org/${slug}/catalog`)
  revalidatePath(`/org/${slug}/catalog/templates`)
  revalidatePath(`/org/${slug}/catalog/templates/${templateId}/edit`)

  return { templateId: savedTemplateId }
}
