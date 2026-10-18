import Link from "next/link"
import { redirect } from "next/navigation"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import type { CatalogField } from "@/app/lib/catalog/types"
import { CatalogItemForm } from "@/app/components/crm/catalog/catalog-item-form"
import { createCatalogItem } from "../actions"

export default async function NewCatalogItemPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  const catalogUrl = `/org/${slug}/catalog`

  if (!canManage) {
    redirect(catalogUrl)
  }

  const { data: templates, error } = await supabase
    .from("catalog_templates")
    .select("id, name, kind, catalog_template_versions(id, status, fields)")
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .order("name", { ascending: true })

  if (error) {
    throw new Error("Unable to load catalog templates.")
  }

  const options = (templates ?? []).flatMap((template) => {
    const version = template.catalog_template_versions.find(
      (entry) => entry.status === "active",
    )

    if (!version) return []

    return [
      {
        versionId: version.id,
        name: template.name,
        kind: template.kind,
        fields: version.fields as unknown as CatalogField[],
      },
    ]
  })

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <Link
          href={catalogUrl}
          className="text-sm text-primary hover:underline">
          ← Catalog
        </Link>

        <h1 className="font-mono text-3xl font-semibold text-foreground">
          New catalog item
        </h1>

        <p className="text-sm text-muted">
          Choose a template and save your product or service as a draft. Drafts
          are not published.
        </p>
      </header>

      {options.length > 0 ? (
        <CatalogItemForm
          templates={options}
          returnUrl={catalogUrl}
          onSave={createCatalogItem.bind(null, slug)}
        />
      ) : (
        <section className="space-y-3 rounded-xl border border-border bg-surface p-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Create a template first
          </h2>

          <p className="text-sm text-muted">
            An active template defines the fields your products or services use.
          </p>

          <Link
            href={`/org/${slug}/catalog/templates/new`}
            className="inline-flex rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
            Create template
          </Link>
        </section>
      )}
    </div>
  )
}
