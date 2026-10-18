import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"
import { AdministratorManager } from "./administrator-manager"

export default async function AdministratorsPage() {
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    redirect("/login")
  }

  const { data: administrator, error: roleError } = await supabase
    .from("platform_admins")
    .select("role")
    .eq("user_id", authData.user.id)
    .maybeSingle()

  if (roleError) {
    throw new Error("Unable to verify platform permissions.")
  }

  if (administrator?.role !== "owner") {
    redirect("/admin")
  }

  const { data: administrators, error } = await supabase.rpc(
    "list_platform_administrators",
  )

  if (error) {
    console.error("Unable to load platform administrators:", error)
    throw new Error("Unable to load platform administrators.")
  }

  return (
    <div className="space-y-8">
      <Link
        href="/admin"
        className="text-sm font-medium text-muted hover:text-primary hover:underline">
        ← Administration
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Platform access
        </p>

        <h1 className="font-mono text-3xl font-semibold tracking-tight text-foreground">
          Administrators
        </h1>

        <p className="text-sm text-muted">
          Manage access to Third Generation Studios platform administration.
          Platform roles are separate from workspace membership.
        </p>
      </header>

      <AdministratorManager administrators={administrators ?? []} />
    </div>
  )
}
