import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import type { CatalogAttributes, CatalogField } from "@/app/lib/catalog/types"
import { CatalogItemForm } from "@/app/components/crm/catalog/catalog-item-form"
import { updateCatalogItem } from "../../actions"

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
    .select("id, name, slug, summary, status, attributes, template_version_id")
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
      </header>

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
