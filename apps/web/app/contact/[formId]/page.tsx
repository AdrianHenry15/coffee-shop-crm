import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createAdminClient } from "@/app/lib/supabase/admin"
import { PublicLeadForm } from "@/app/components/crm/public-lead-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Contact | CoffeeShopCRM",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function PublicContactPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      formId,
    )
  ) {
    notFound()
  }

  const admin = createAdminClient()

  const { data, error } = await admin.rpc("get_public_lead_form", {
    p_form_id: formId,
  })

  if (error) {
    throw new Error("Unable to load this contact form.")
  }

  const form = data?.[0]

  if (!form) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-3">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            {form.workspace_name}
          </p>

          <h1 className="font-mono text-3xl font-semibold text-foreground">
            {form.title}
          </h1>

          <p className="text-sm leading-relaxed text-muted">
            Send your inquiry to {form.workspace_name}. No account is required.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
          <PublicLeadForm
            formId={form.form_id}
            workspaceName={form.workspace_name}
          />
        </section>

        <footer className="text-center text-xs text-muted">
          Powered by{" "}
          <Link href="/" className="text-primary hover:underline">
            CoffeeShopCRM
          </Link>
        </footer>
      </div>
    </main>
  )
}
