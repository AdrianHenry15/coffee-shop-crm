import {
  authorizeWebsiteRequest,
  catalogJson,
  IMAGE_URL_LIFETIME,
  loadWebsiteCatalogImages,
} from "@/app/lib/catalog/website-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const authorization = await authorizeWebsiteRequest(request)

    if (!authorization.ok) {
      return authorization.response
    }

    const { admin, organizationId } = authorization
    const url = new URL(request.url)

    const pageValue = url.searchParams.get("page") ?? "1"
    const limitValue = url.searchParams.get("limit") ?? "10"
    const kind = url.searchParams.get("kind")

    if (!/^\d{1,4}$/.test(pageValue) || !/^\d{1,2}$/.test(limitValue)) {
      return catalogJson({ error: "Invalid pagination." }, 400)
    }

    const page = Number(pageValue)
    const limit = Number(limitValue)

    if (page < 1 || page > 1000 || limit < 1 || limit > 20) {
      return catalogJson({ error: "Use page 1–1000 and limit 1–20." }, 400)
    }

    if (kind !== null && kind !== "product" && kind !== "service") {
      return catalogJson({ error: "Kind must be product or service." }, 400)
    }

    let query = admin
      .from("catalog_items")
      .select(
        `
          id,
          name,
          slug,
          summary,
          price_mode,
          price_cents,
          currency,
          catalog_template_versions!inner(
            catalog_templates!inner(kind, archived_at)
          )
        `,
      )
      .eq("organization_id", organizationId)
      .eq("status", "published")
      .is("catalog_template_versions.catalog_templates.archived_at", null)

    if (kind) {
      query = query.eq("catalog_template_versions.catalog_templates.kind", kind)
    }

    const offset = (page - 1) * limit

    // Fetch one extra record to determine whether another page exists.
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + limit)

    if (error) throw error

    const rows = data ?? []
    const items = rows.slice(0, limit)

    const images = await loadWebsiteCatalogImages(
      admin,
      organizationId,
      items.map((item) => item.id),
      true,
    )

    return catalogJson({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        summary: item.summary,
        kind: item.catalog_template_versions.catalog_templates.kind,
        pricing: {
          mode: item.price_mode,
          amountCents: item.price_cents,
          currency: item.currency,
        },
        image: images.get(item.id)?.[0] ?? null,
      })),
      pagination: {
        page,
        limit,
        hasMore: rows.length > limit,
      },
      imageUrlsExpireIn: IMAGE_URL_LIFETIME,
    })
  } catch (error) {
    console.error("Unable to load website catalog listing:", error)

    return catalogJson(
      { error: "Catalog service temporarily unavailable." },
      503,
    )
  }
}
