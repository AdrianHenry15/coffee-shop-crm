import "server-only"

import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/app/lib/supabase/admin"

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>

type AuthorizationResult =
  | {
      ok: true
      admin: AdminClient
      organizationId: string
    }
  | {
      ok: false
      response: NextResponse
    }

export type WebsiteCatalogImage = {
  id: string
  alt: string
  url: string
}

export const IMAGE_URL_LIFETIME = 600

export function catalogJson(body: unknown, status = 200) {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  }

  if (status === 401) {
    headers["WWW-Authenticate"] = 'Bearer realm="catalog"'
  }

  return NextResponse.json(body, { status, headers })
}

export async function authorizeWebsiteRequest(
  request: Request,
): Promise<AuthorizationResult> {
  const authorization = request.headers.get("authorization") ?? ""

  const match = /^Bearer (crm_catalog_[0-9a-f]{64})$/i.exec(authorization)

  if (!match) {
    return {
      ok: false,
      response: catalogJson({ error: "Invalid catalog credentials." }, 401),
    }
  }

  const hash = createHash("sha256").update(match[1]).digest("hex")

  const admin = await createAdminClient()

  const { data: connection, error } = await admin
    .from("catalog_website_connections")
    .select("organization_id")
    .eq("api_key_hash", hash)
    .eq("enabled", true)
    .maybeSingle()

  if (error) {
    console.error("Unable to verify catalog connection:", error)

    return {
      ok: false,
      response: catalogJson(
        { error: "Catalog service temporarily unavailable." },
        503,
      ),
    }
  }

  if (!connection) {
    return {
      ok: false,
      response: catalogJson({ error: "Invalid catalog credentials." }, 401),
    }
  }

  return {
    ok: true,
    admin,
    organizationId: connection.organization_id,
  }
}

export async function loadWebsiteCatalogImages(
  admin: AdminClient,
  organizationId: string,
  itemIds: string[],
  primaryOnly = false,
): Promise<Map<string, WebsiteCatalogImage[]>> {
  const result = new Map<string, WebsiteCatalogImage[]>()

  if (itemIds.length === 0) return result

  const { data: images, error } = await admin
    .from("catalog_item_images")
    .select("id, item_id, object_path, alt_text, position, created_at")
    .eq("organization_id", organizationId)
    .in("item_id", itemIds)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw error

  const selected = []
  const seenItems = new Set<string>()

  for (const image of images ?? []) {
    if (!image.object_path) continue
    if (primaryOnly && seenItems.has(image.item_id)) continue

    selected.push({
      ...image,
      object_path: image.object_path,
    })

    seenItems.add(image.item_id)
  }

  if (selected.length === 0) return result

  const { data: signedImages, error: signingError } = await admin.storage
    .from("catalog-images")
    .createSignedUrls(
      selected.map((image) => image.object_path),
      IMAGE_URL_LIFETIME,
    )

  if (signingError) throw signingError

  const urls = new Map<string, string>()

  for (const image of signedImages ?? []) {
    if (image.path && image.signedUrl && !image.error) {
      urls.set(image.path, image.signedUrl)
    }
  }

  for (const image of selected) {
    const url = urls.get(image.object_path)

    if (!url) continue

    const gallery = result.get(image.item_id) ?? []

    gallery.push({
      id: image.id,
      alt: image.alt_text,
      url,
    })

    result.set(image.item_id, gallery)
  }

  return result
}
