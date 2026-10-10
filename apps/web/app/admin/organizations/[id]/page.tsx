import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"

function formatDate(value: string | null) {
  if (!value) return "Not set"

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function formatBenefit(value: string) {
  switch (value) {
    case "partner_plus":
      return "Partner+"
    case "partner":
      return "Partner"
    default:
      return "Standard"
  }
}

export default async function OrganizationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()

  const { data: organization, error } = await supabase
    .rpc("get_platform_organization_details", {
      org_uuid: id,
    })
    .single()

  if (error?.code === "PGRST116") {
    notFound()
  }

  if (error) {
    throw new Error("Unable to load organization details.")
  }

  if (!organization) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/organizations"
          className="text-sm text-foreground/60 hover:underline">
          ← Organizations
        </Link>

        <h1 className="mt-4 text-3xl font-semibold">
          {organization.organization_name}
        </h1>

        <p className="mt-2 text-sm text-foreground/60">
          {organization.organization_slug}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-4 rounded-lg border border-foreground/15 p-6">
          <div>
            <h2 className="text-lg font-semibold">Subscription</h2>

            <p className="text-sm text-foreground/60">
              Current CRM subscription
            </p>
          </div>

          <div>
            <p className="text-sm text-foreground/60">Plan</p>

            <p className="mt-1 text-xl font-semibold">
              {organization.plan_name ?? "No plan"}
            </p>
          </div>

          <div>
            <p className="text-sm text-foreground/60">Status</p>

            <p className="mt-1 capitalize">
              {organization.subscription_status?.replaceAll("_", " ") ??
                "Unknown"}
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-foreground/15 p-6">
          <div>
            <h2 className="text-lg font-semibold">Partner Benefits</h2>

            <p className="text-sm text-foreground/60">
              TGS development and maintenance benefits
            </p>
          </div>

          <div>
            <p className="text-sm text-foreground/60">Current level</p>

            <p className="mt-1 text-xl font-semibold">
              {formatBenefit(organization.benefit_level)}
            </p>
          </div>

          <div>
            <p className="text-sm text-foreground/60">Partner granted</p>

            <p className="mt-1">
              {formatDate(organization.partner_granted_at)}
            </p>
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-lg border border-foreground/15 p-6">
        <div>
          <h2 className="text-lg font-semibold">Maintenance Agreement</h2>

          <p className="text-sm text-foreground/60">
            Active maintenance agreements provide Partner+ benefits.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-foreground/60">Starts</p>

            <p className="mt-1">
              {formatDate(organization.maintenance_starts_at)}
            </p>
          </div>

          <div>
            <p className="text-sm text-foreground/60">Ends</p>

            <p className="mt-1">
              {formatDate(organization.maintenance_ends_at)}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-foreground/15 p-6">
        <h2 className="text-lg font-semibold">Organization Information</h2>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-foreground/60">Organization ID</dt>

            <dd className="mt-1 break-all font-mono">
              {organization.organization_id}
            </dd>
          </div>

          <div>
            <dt className="text-foreground/60">Created</dt>

            <dd className="mt-1">
              {formatDate(organization.organization_created_at)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
