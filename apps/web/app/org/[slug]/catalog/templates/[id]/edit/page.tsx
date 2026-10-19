import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import type { CatalogField } from "@/app/lib/catalog/types"
import { TemplateEditor } from "@/app/components/crm/catalog/template-editor"
import { updateCatalogTemplate } from "../../actions"

export default async function EditCatalogTemplatePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const { organization, supabase, canManage } = await getCatalogAccess(slug)

  const returnUrl = `/org/${slug}/catalog/templates`

  if (!canManage) {
    redirect(returnUrl)
  }

  const { data: template, error: templateError } = await supabase
    .from("catalog_templates")
    .select("id, name, description, kind")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .maybeSingle()

  if (templateError) {
    throw new Error("Unable to load the catalog template.")
  }

  if (!template) {
    notFound()
  }

  if (template.kind !== "product" && template.kind !== "service") {
    throw new Error("Unsupported catalog template type.")
  }

  const { data: version, error: versionError } = await supabase
    .from("catalog_template_versions")
    .select("id, version_number, fields")
    .eq("template_id", template.id)
    .eq("organization_id", organization.id)
    .eq("status", "active")
    .maybeSingle()

  if (versionError) {
    throw new Error("Unable to load the active template version.")
  }

  if (!version) {
    return (
      <div className="space-y-4">
        <Link href={returnUrl} className="text-sm text-primary hover:underline">
          ← Templates
        </Link>

        <p className="text-sm text-muted">
          This template has no active version to edit.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-8">
      <header className="space-y-3">
        <Link href={returnUrl} className="text-sm text-primary hover:underline">
          ← Templates
        </Link>

        <h1 className="font-mono text-3xl font-semibold text-foreground">
          Edit {template.name}
        </h1>

        <p className="text-sm text-muted">
          Editing version {version.version_number}. Saving activates a new
          version for future products and services.
        </p>
      </header>

      <TemplateEditor
        key={version.id}
        returnUrl={returnUrl}
        initialTemplate={{
          name: template.name,
          description: template.description ?? "",
          kind: template.kind,
          fields: version.fields as unknown as CatalogField[],
        }}
        onSave={updateCatalogTemplate.bind(null, slug, template.id, version.id)}
      />
    </div>
  )
}
