import { getOrganization } from "@/lib/organizations"
import { OrganizationSettings } from "@/app/components/crm/organization-settings"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { slug } = await params
  const organization = await getOrganization(slug)

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-gray-500">
          Manage preferences for {organization.name}.
        </p>
      </div>

      <OrganizationSettings slug={slug} timezone={organization.timezone} />
    </main>
  )
}
