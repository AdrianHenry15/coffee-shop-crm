"use server"

import { revalidatePath } from "next/cache"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import type {
  CatalogAttributes,
  CreateCatalogItemResult,
} from "@/app/lib/catalog/types"

function isCatalogAttributes(value: unknown): value is CatalogAttributes {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every((attribute) => {
    if (typeof attribute === "string" || typeof attribute === "boolean") {
      return true
    }

    if (typeof attribute === "number") {
      return Number.isFinite(attribute)
    }

    return (
      Array.isArray(attribute) &&
      attribute.every((entry) => typeof entry === "string")
    )
  })
}

export async function createCatalogItem(
  slug: string,
  formData: FormData,
): Promise<CreateCatalogItemResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return {
      error: "Only workspace owners and admins can manage the catalog.",
    }
  }

  const templateVersionId = String(
    formData.get("templateVersionId") ?? "",
  ).trim()

  const name = String(formData.get("name") ?? "").trim()
  const itemSlug = String(formData.get("slug") ?? "").trim()
  const summary = String(formData.get("summary") ?? "").trim()
  const rawAttributes = String(formData.get("attributes") ?? "{}")

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      templateVersionId,
    )
  ) {
    return { error: "Choose a catalog template." }
  }

  if (!name || name.length > 200) {
    return { error: "Enter an item name up to 200 characters." }
  }

  if (itemSlug.length > 120 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(itemSlug)) {
    return {
      error:
        "Use a slug up to 120 characters with lowercase letters, numbers, and single hyphens between words.",
    }
  }

  if (summary.length > 500) {
    return { error: "Keep the summary to 500 characters or fewer." }
  }

  if (new TextEncoder().encode(rawAttributes).byteLength > 128 * 1024) {
    return { error: "The custom field data is too large." }
  }

  let attributes: unknown

  try {
    attributes = JSON.parse(rawAttributes)
  } catch {
    return { error: "The custom field data is invalid." }
  }

  if (!isCatalogAttributes(attributes)) {
    return { error: "The custom field data contains unsupported values." }
  }

  const { data: item, error } = await supabase
    .from("catalog_items")
    .insert({
      organization_id: organization.id,
      template_version_id: templateVersionId,
      name,
      slug: itemSlug,
      summary: summary || null,
      attributes,
      status: "draft",
      price_mode: "quote",
    })
    .select("id")
    .single()

  if (error || !item) {
    console.error("Unable to create catalog item:", error)

    if (error?.code === "23505") {
      return {
        error: "An item with this slug already exists in this workspace.",
      }
    }

    return {
      error:
        "Unable to save the draft. Check the template and custom field values.",
    }
  }

  revalidatePath(`/org/${slug}/catalog`)

  return { itemId: item.id }
}

export async function updateCatalogItem(
  slug: string,
  itemId: string,
  formData: FormData,
): Promise<CreateCatalogItemResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return {
      error: "Only workspace owners and admins can manage the catalog.",
    }
  }

  const name = String(formData.get("name") ?? "").trim()
  const itemSlug = String(formData.get("slug") ?? "").trim()
  const summary = String(formData.get("summary") ?? "").trim()
  const rawAttributes = String(formData.get("attributes") ?? "{}")

  if (!name || name.length > 200) {
    return { error: "Enter an item name up to 200 characters." }
  }

  if (itemSlug.length > 120 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(itemSlug)) {
    return {
      error:
        "Use a slug up to 120 characters with lowercase letters, numbers, and single hyphens between words.",
    }
  }

  if (summary.length > 500) {
    return { error: "Keep the summary to 500 characters or fewer." }
  }

  if (new TextEncoder().encode(rawAttributes).byteLength > 128 * 1024) {
    return { error: "The custom field data is too large." }
  }

  let attributes: unknown

  try {
    attributes = JSON.parse(rawAttributes)
  } catch {
    return { error: "The custom field data is invalid." }
  }

  if (!isCatalogAttributes(attributes)) {
    return { error: "The custom field data contains unsupported values." }
  }

  const { data: item, error } = await supabase
    .from("catalog_items")
    .update({
      name,
      slug: itemSlug,
      summary: summary || null,
      attributes,
    })
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .eq("status", "draft")
    .select("id")
    .single()

  if (error || !item) {
    console.error("Unable to update catalog draft:", error)

    if (error?.code === "23505") {
      return {
        error: "An item with this slug already exists in this workspace.",
      }
    }

    return {
      error:
        "Unable to save the draft. Check its current status and custom field values.",
    }
  }

  revalidatePath(`/org/${slug}/catalog`)
  revalidatePath(`/org/${slug}/catalog/${itemId}/edit`)

  return { itemId: item.id }
}
