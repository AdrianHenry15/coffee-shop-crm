import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import type { CatalogAttributes, CatalogField } from "@/app/lib/catalog/types"
import { CatalogItemForm } from "@/app/components/crm/catalog/catalog-item-form"
import { updateCatalogItem } from "../../actions"
import { CatalogImageGallery } from "@/app/components/crm/catalog/catalog-image-gallery"
import {
  removeCatalogImage,
  setPrimaryCatalogImage,
  updateCatalogImageAlt,
} from "../../image-actions"

export default async function EditCatalogItemPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  const catalogUrl = `/org/${slug}/catalog`

  if (!canManage) {
    redirect(catalogUrl)
  }

  const { data: item, error: itemError } = await supabase
    .from("catalog_items")
    .select(
      "id, name, slug, summary, status, attributes, template_version_id, price_mode, price_cents",
    )
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle()

  if (itemError) {
    throw new Error("Unable to load the catalog item.")
  }

  if (!item) {
    notFound()
  }

  if (item.status !== "draft") {
    redirect(catalogUrl)
  }

  const { data: version, error: versionError } = await supabase
    .from("catalog_template_versions")
    .select("id, template_id, fields")
    .eq("id", item.template_version_id)
    .eq("organization_id", organization.id)
    .single()

  if (versionError || !version) {
    throw new Error("Unable to load the item's template version.")
  }

  const { data: template, error: templateError } = await supabase
    .from("catalog_templates")
    .select("name, kind")
    .eq("id", version.template_id)
    .eq("organization_id", organization.id)
    .single()

  if (templateError || !template) {
    throw new Error("Unable to load the item's template.")
  }

  const { data: images, error: imagesError } = await supabase
    .from("catalog_item_images")
    .select("id, object_path, alt_text, position, created_at")
    .eq("organization_id", organization.id)
    .eq("item_id", item.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (imagesError) {
    throw new Error("Unable to load catalog images.")
  }

  const imageRows = images ?? []
  const signedUrls = new Map<string, string>()

  const imagePaths = imageRows
    .map((image) => image.object_path)
    .filter((path): path is string => typeof path === "string")

  if (imagePaths.length > 0) {
    const { data: signedImages, error: signingError } = await supabase.storage
      .from("catalog-images")
      .createSignedUrls(imagePaths, 3600)

    if (signingError) {
      console.error("Unable to create catalog image previews:", signingError)
    }

    for (const image of signedImages ?? []) {
      if (image.path && image.signedUrl && !image.error) {
        signedUrls.set(image.path, image.signedUrl)
      }
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <Link
          href={catalogUrl}
          className="text-sm text-primary hover:underline">
          ← Catalog
        </Link>

        <h1 className="font-mono text-3xl font-semibold text-foreground">
          Edit catalog draft
        </h1>

        <p className="text-sm text-muted">
          Update {item.name}. Saving keeps this item as a draft.
        </p>
        <Link
          href={`/org/${slug}/catalog/${item.id}`}
          className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-secondary">
          Preview and publish
        </Link>
      </header>

      <CatalogImageGallery
        organizationId={organization.id}
        itemId={item.id}
        images={imageRows.map((image) => ({
          id: image.id,
          altText: image.alt_text,
          position: image.position,
          url: image.object_path
            ? (signedUrls.get(image.object_path) ?? null)
            : null,
        }))}
        onSetPrimary={setPrimaryCatalogImage.bind(null, slug, item.id)}
        onRemove={removeCatalogImage.bind(null, slug, item.id)}
        onSaveAlt={updateCatalogImageAlt.bind(null, slug, item.id)}
      />

      <CatalogItemForm
        key={item.id}
        templates={[
          {
            versionId: version.id,
            name: template.name,
            kind: template.kind,
            fields: version.fields as unknown as CatalogField[],
          },
        ]}
        initialItem={{
          priceMode:
            item.price_mode === "fixed" || item.price_mode === "starting_at"
              ? item.price_mode
              : "quote",
          priceCents: item.price_cents,
          templateVersionId: version.id,
          name: item.name,
          slug: item.slug,
          summary: item.summary ?? "",
          attributes: item.attributes as CatalogAttributes,
        }}
        returnUrl={catalogUrl}
        onSave={updateCatalogItem.bind(null, slug, item.id)}
      />
    </div>
  )
}
