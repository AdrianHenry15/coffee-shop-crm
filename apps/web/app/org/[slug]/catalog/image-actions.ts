"use server"

import { revalidatePath } from "next/cache"
import { getCatalogAccess } from "@/app/lib/catalog/access"

type ImageActionResult = {
  error?: string
}

function refreshGallery(slug: string, itemId: string) {
  revalidatePath(`/org/${slug}/catalog`)
  revalidatePath(`/org/${slug}/catalog/${itemId}/edit`)
}

export async function setPrimaryCatalogImage(
  slug: string,
  itemId: string,
  imageId: string,
): Promise<ImageActionResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return { error: "You do not have permission to manage images." }
  }

  const { error } = await supabase.rpc("set_catalog_primary_image", {
    p_organization_id: organization.id,
    p_item_id: itemId,
    p_image_id: imageId,
  })

  if (error) {
    console.error("Unable to select primary catalog image:", error)
    return { error: "Unable to change the primary image." }
  }

  refreshGallery(slug, itemId)
  return {}
}

export async function updateCatalogImageAlt(
  slug: string,
  itemId: string,
  imageId: string,
  altText: string,
): Promise<ImageActionResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return { error: "You do not have permission to manage images." }
  }

  if (typeof altText !== "string" || altText.trim().length > 500) {
    return { error: "Image descriptions must be 500 characters or fewer." }
  }

  const { data, error } = await supabase
    .from("catalog_item_images")
    .update({ alt_text: altText.trim() })
    .eq("id", imageId)
    .eq("item_id", itemId)
    .eq("organization_id", organization.id)
    .select("id")
    .single()

  if (error || !data) {
    console.error("Unable to update catalog image description:", error)
    return { error: "Unable to save the image description." }
  }

  refreshGallery(slug, itemId)
  return {}
}

export async function removeCatalogImage(
  slug: string,
  itemId: string,
  imageId: string,
): Promise<ImageActionResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return { error: "You do not have permission to manage images." }
  }

  const { data: image, error: imageError } = await supabase
    .from("catalog_item_images")
    .select("id, object_path")
    .eq("id", imageId)
    .eq("item_id", itemId)
    .eq("organization_id", organization.id)
    .single()

  if (imageError || !image?.object_path) {
    return { error: "Image not found or access denied." }
  }

  // Remove the actual file through the Storage API first.
  const { error: storageError } = await supabase.storage
    .from("catalog-images")
    .remove([image.object_path])

  if (storageError) {
    console.error("Unable to remove catalog image file:", storageError)
    return { error: "Unable to remove the image file. Please try again." }
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("catalog_item_images")
    .delete()
    .eq("id", image.id)
    .eq("item_id", itemId)
    .eq("organization_id", organization.id)
    .select("id")
    .single()

  refreshGallery(slug, itemId)

  if (deleteError || !deleted) {
    console.error("Unable to remove catalog image record:", deleteError)
    return {
      error:
        "The file was removed, but its gallery record could not be removed. Please retry.",
    }
  }

  return {}
}
