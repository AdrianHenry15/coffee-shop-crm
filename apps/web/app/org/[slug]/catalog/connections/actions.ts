"use server"

import { createHash, randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getCatalogAccess } from "@/app/lib/catalog/access"

export type ConnectionActionResult = {
  error?: string
  apiKey?: string
  connectionId?: string
}

function generateKey() {
  const apiKey = `crm_catalog_${randomBytes(32).toString("hex")}`

  const hash = createHash("sha256")
    .update(apiKey)
    .digest("hex")

  return { apiKey, hash }
}

function refreshConnections(slug: string) {
  revalidatePath(`/org/${slug}/catalog/connections`)
}

export async function createWebsiteConnection(
  slug: string,
  formData: FormData,
): Promise<ConnectionActionResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return { error: "Only workspace owners and admins can manage connections." }
  }

  const name = String(formData.get("name") ?? "").trim()

  if (!name || name.length > 100) {
    return { error: "Enter a connection name up to 100 characters." }
  }

  const { apiKey, hash } = generateKey()

  const { data, error } = await supabase
    .from("catalog_website_connections")
    .insert({
      organization_id: organization.id,
      name,
      api_key_hash: hash,
      enabled: false,
    })
    .select("id")
    .single()

  if (error || !data) {
    console.error("Unable to create website connection:", error)
    return { error: "Unable to create the connection. Please try again." }
  }

  refreshConnections(slug)

  return {
    connectionId: data.id,
    apiKey,
  }
}

export async function setWebsiteConnectionEnabled(
  slug: string,
  connectionId: string,
  enabled: boolean,
): Promise<ConnectionActionResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return { error: "Only workspace owners and admins can manage connections." }
  }

  if (typeof enabled !== "boolean") {
    return { error: "Invalid connection status." }
  }

  const { data, error } = await supabase
    .from("catalog_website_connections")
    .update({ enabled })
    .eq("id", connectionId)
    .eq("organization_id", organization.id)
    .select("id")
    .single()

  if (error || !data) {
    console.error("Unable to update website connection:", error)
    return { error: "Unable to change the connection status." }
  }

  refreshConnections(slug)
  return {}
}

export async function rotateWebsiteConnectionKey(
  slug: string,
  connectionId: string,
): Promise<ConnectionActionResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return { error: "Only workspace owners and admins can manage connections." }
  }

  const { apiKey, hash } = generateKey()

  const { data, error } = await supabase
    .from("catalog_website_connections")
    .update({ api_key_hash: hash })
    .eq("id", connectionId)
    .eq("organization_id", organization.id)
    .select("id")
    .single()

  if (error || !data) {
    console.error("Unable to rotate website connection key:", error)
    return { error: "Unable to replace the API key." }
  }

  refreshConnections(slug)

  return {
    connectionId: data.id,
    apiKey,
  }
}

export async function deleteWebsiteConnection(
  slug: string,
  connectionId: string,
): Promise<ConnectionActionResult> {
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    return { error: "Only workspace owners and admins can manage connections." }
  }

  const { data, error } = await supabase
    .from("catalog_website_connections")
    .delete()
    .eq("id", connectionId)
    .eq("organization_id", organization.id)
    .select("id")
    .single()

  if (error || !data) {
    console.error("Unable to delete website connection:", error)
    return { error: "Unable to delete the connection." }
  }

  refreshConnections(slug)
  return {}
}