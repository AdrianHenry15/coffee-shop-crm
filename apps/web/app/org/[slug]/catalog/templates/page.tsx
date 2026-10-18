import Link from "next/link"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import type { CatalogField } from "@/app/lib/catalog/types"

export default async function CatalogTemplatesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  const { data: templates, error } = await supabase
    .from("catalog_templates")
    .select(
      "id, name, description, kind, catalog_template_versions(id, version_number, status, fields)",
    )
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("Unable to load catalog templates.")
  }

  return (
    <div className="space-y-8">
      <Link
        href={`/org/${slug}/catalog`}
        className="text-sm font-medium text-muted hover:text-primary hover:underline">
        ← Catalog
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-mono text-3xl font-semibold text-foreground">
            Catalog templates
          </h1>

          <p className="text-sm text-muted">
            Reusable field definitions for your products and services.
          </p>
        </div>

        {canManage && (
          <Link
            href={`/org/${slug}/catalog/templates/new`}
            className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Create template
          </Link>
        )}
      </header>

      {!templates?.length ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-medium text-foreground">No templates yet</p>

          <p className="mt-2 text-sm text-muted">
            {canManage
              ? "Create a template for your first product or service."
              : "A workspace owner or admin can create catalog templates."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => {
            const activeVersion = template.catalog_template_versions.find(
              (version) => version.status === "active",
            )

            const fields = activeVersion
              ? (activeVersion.fields as CatalogField[])
              : []

            return (
              <section
                key={template.id}
                className="space-y-4 rounded-xl border border-border bg-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-mono text-lg font-semibold text-foreground">
                      {template.name}
                    </h2>

                    {template.description && (
                      <p className="mt-2 text-sm text-muted">
                        {template.description}
                      </p>
                    )}
                  </div>

                  <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs capitalize text-primary">
                    {template.kind}
                  </span>
                </div>

                <p className="text-xs text-muted">
                  {activeVersion
                    ? `Active version ${activeVersion.version_number} · ${fields.length} custom fields`
                    : "No active version"}
                </p>

                {fields.length > 0 && (
                  <details className="border-t border-border pt-4">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      View fields
                    </summary>

                    <ul className="mt-3 divide-y divide-border">
                      {fields.map((field) => (
                        <li
                          key={field.key}
                          className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                          <div>
                            <p className="font-medium text-foreground">
                              {field.label}
                              {field.unit ? ` (${field.unit})` : ""}
                            </p>

                            <p className="mt-1 font-mono text-xs text-muted">
                              {field.key}
                              {field.group ? ` · ${field.group}` : ""}
                            </p>
                          </div>

                          <p className="text-muted">
                            {field.type}
                            {field.required ? " · Required" : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
