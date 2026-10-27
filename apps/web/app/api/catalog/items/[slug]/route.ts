import type { CatalogField } from "@/app/lib/catalog/types"
import { parseCatalogSections } from "@/app/lib/catalog/sections"
import {
  authorizeWebsiteRequest,
  catalogJson,
  IMAGE_URL_LIFETIME,
  loadWebsiteCatalogImages,
} from "@/app/lib/catalog/website-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const authorization = await authorizeWebsiteRequest(request)

    if (!authorization.ok) {
      return authorization.response
    }

    const { slug } = await params

    if (slug.length > 120 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return catalogJson({ error: "Item not found." }, 404)
    }

    const { admin, organizationId } = authorization

    const { data: item, error } = await admin
      .from("catalog_items")
      .select(
        `
          id,
          name,
          slug,
          summary,
          attributes,
          price_mode,
          price_cents,
          currency,
          catalog_template_versions!inner(
            fields,
            catalog_templates!inner(kind, archived_at)
          )
        `,
      )
      .eq("organization_id", organizationId)
      .eq("status", "published")
      .eq("slug", slug)
      .is("catalog_template_versions.catalog_templates.archived_at", null)
      .maybeSingle()

    if (error) throw error

    if (!item) {
      return catalogJson({ error: "Item not found." }, 404)
    }

    const [gallery, sectionsResult] = await Promise.all([
      loadWebsiteCatalogImages(admin, organizationId, [item.id]),

      admin
        .from("catalog_item_sections")
        .select("id, title, kind, content")
        .eq("organization_id", organizationId)
        .eq("item_id", item.id)
        .order("position", { ascending: true })
        .order("id", { ascending: true }),
    ])

    if (sectionsResult.error) throw sectionsResult.error

    const fields = item.catalog_template_versions
      .fields as unknown as CatalogField[]

    return catalogJson({
      item: {
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
        fields,
        attributes: item.attributes,
        sections: parseCatalogSections(sectionsResult.data ?? []),
        images: gallery.get(item.id) ?? [],
      },
      imageUrlsExpireIn: IMAGE_URL_LIFETIME,
    })
  } catch (error) {
    console.error("Unable to load website catalog item:", error)

    return catalogJson(
      { error: "Catalog service temporarily unavailable." },
      503,
    )
  }
}
