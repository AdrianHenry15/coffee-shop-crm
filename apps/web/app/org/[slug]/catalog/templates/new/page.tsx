import Link from "next/link"
import { redirect } from "next/navigation"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import { TemplateEditor } from "@/app/components/crm/catalog/template-editor"
import { createCatalogTemplate } from "../actions"

export default async function NewCatalogTemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    redirect(`/org/${slug}/catalog/templates`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href={`/org/${slug}/catalog/templates`}
        className="text-sm font-medium text-muted hover:text-primary hover:underline">
        ← Catalog templates
      </Link>

      <header className="space-y-2">
        <h1 className="font-mono text-3xl font-semibold text-foreground">
          Create catalog template
        </h1>

        <p className="text-sm text-muted">
          Define the information your products or services need.
        </p>
      </header>

      <TemplateEditor
        returnUrl={`/org/${slug}/catalog/templates`}
        onSave={createCatalogTemplate.bind(null, slug)}
      />
    </div>
  )
}
