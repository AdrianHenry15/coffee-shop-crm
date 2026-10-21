"use server"

import { revalidatePath } from "next/cache"
import { getCatalogAccess } from "@/app/lib/catalog/access"

type PublicationResult = {
  error?: string
}

async function changePublicationStatus(
  slug: string,
  itemId: string,
  currentStatus: "draft" | "published",
  nextStatus: "draft" | "published",
): Promise<PublicationResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return {
      error: "Only workspace owners and admins can publish catalog items.",
    }
  }

  // The database independently checks required fields when publishing.
  const { data: item, error } = await supabase
    .from("catalog_items")
    .update({ status: nextStatus })
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("Unable to change catalog publication status:", error)

    return {
      error:
        nextStatus === "published"
          ? "Unable to publish. Complete the required custom fields and check that the template is not archived."
          : "Unable to move this item back to draft.",
    }
  }

  if (!item) {
    return {
      error:
        "This item's status changed or it is unavailable. Refresh the page and try again.",
    }
  }

  revalidatePath(`/org/${slug}/catalog`)
  revalidatePath(`/org/${slug}/catalog/${itemId}`)
  revalidatePath(`/org/${slug}/catalog/${itemId}/edit`)

  return {}
}

export async function publishCatalogItem(
  slug: string,
  itemId: string,
): Promise<PublicationResult> {
  return changePublicationStatus(slug, itemId, "draft", "published")
}

export async function unpublishCatalogItem(
  slug: string,
  itemId: string,
): Promise<PublicationResult> {
  return changePublicationStatus(slug, itemId, "published", "draft")
}
