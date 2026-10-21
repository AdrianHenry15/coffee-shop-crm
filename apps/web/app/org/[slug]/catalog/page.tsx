import Link from "next/link"
import { getCatalogAccess } from "@/app/lib/catalog/access"

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  const { data: items, error } = await supabase
    .from("catalog_items")
    .select("id, name, slug, status")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("Unable to load the catalog.")
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Products & services
          </p>

          <h1 className="font-mono text-3xl font-semibold text-foreground">
            Catalog
          </h1>

          <p className="text-sm text-muted">
            Manage the products and services offered by {organization.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/org/${slug}/catalog/templates`}
            className="rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-secondary">
            Templates
          </Link>

          {canManage && (
            <Link
              href={`/org/${slug}/catalog/new`}
              className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
              New item
            </Link>
          )}
        </div>
      </header>

      {!items?.length ? (
        <section className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Your catalog starts with a template
          </h2>

          <p className="mt-2 text-sm text-muted">
            Define the fields your products or services need, such as
            dimensions, power source, service area, or duration.
          </p>

          <Link
            href={`/org/${slug}/catalog/templates`}
            className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline">
            View catalog templates →
          </Link>
        </section>
      ) : (
        <section className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h2 className="font-medium text-foreground">
                  <Link
                    href={`/org/${slug}/catalog/${item.id}`}
                    className="hover:text-primary hover:underline">
                    {item.name}
                  </Link>
                </h2>

                <p className="mt-1 font-mono text-xs text-muted">{item.slug}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-full bg-surface-secondary px-3 py-1 font-mono text-xs capitalize text-foreground">
                  {item.status}
                </span>

                {canManage && item.status === "draft" && (
                  <Link
                    href={`/org/${slug}/catalog/${item.id}/edit`}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-secondary">
                    Edit draft
                  </Link>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
