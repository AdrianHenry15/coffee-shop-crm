"use server"

import { revalidatePath } from "next/cache"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import { parseCatalogSections } from "@/app/lib/catalog/sections"

export async function saveCatalogSections(
  slug: string,
  itemId: string,
  expectedUpdatedAt: string,
  rawSections: string,
): Promise<{ error?: string }> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return { error: "Only workspace owners and admins can edit content." }
  }

  if (
    typeof rawSections !== "string" ||
    new TextEncoder().encode(rawSections).byteLength > 524288
  ) {
    return { error: "The content is too large. Shorten some sections." }
  }

  let sections

  try {
    sections = parseCatalogSections(JSON.parse(rawSections))
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid section data.",
    }
  }

  const { error } = await supabase.rpc("save_catalog_item_sections", {
    p_organization_id: organization.id,
    p_item_id: itemId,
    p_expected_updated_at: expectedUpdatedAt,
    p_sections: sections,
  })

  if (error) {
    console.error("Unable to save catalog sections:", error)

    return {
      error:
        error.code === "40001"
          ? "This item changed after you opened it. Copy any unsaved content, then reload before saving."
          : "Unable to save content. Check the sections and confirm this item is still a draft.",
    }
  }

  revalidatePath(`/org/${slug}/catalog/${itemId}`)
  revalidatePath(`/org/${slug}/catalog/${itemId}/edit`)

  return {}
}
