import Link from "next/link"
import { redirect } from "next/navigation"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import { WebsiteConnectionManager } from "@/app/components/crm/catalog/website-connection-manager"
import {
  createWebsiteConnection,
  deleteWebsiteConnection,
  rotateWebsiteConnectionKey,
  setWebsiteConnectionEnabled,
} from "./actions"

export default async function WebsiteConnectionsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  if (!canManage) {
    redirect(`/org/${slug}/catalog`)
  }

  const { data: connections, error } = await supabase
    .from("catalog_website_connections")
    .select("id, name, enabled")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("Unable to load website connections.")
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <Link
          href={`/org/${slug}/catalog`}
          className="text-sm text-primary hover:underline">
          ← Catalog
        </Link>

        <h1 className="font-mono text-3xl font-semibold text-foreground">
          Website connections
        </h1>

        <p className="text-sm text-muted">
          Manage website access to the published catalog for{" "}
          {organization.name}.
        </p>

        <p className="text-sm text-muted">
          Use a separate connection for each website or environment.
          New connections start disabled.
        </p>
      </header>

      <WebsiteConnectionManager
        connections={connections ?? []}
        onCreate={createWebsiteConnection.bind(null, slug)}
        onSetEnabled={setWebsiteConnectionEnabled.bind(null, slug)}
        onRotate={rotateWebsiteConnectionKey.bind(null, slug)}
        onDelete={deleteWebsiteConnection.bind(null, slug)}
      />
    </div>
  )
}