import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    redirect("/login")
  }

  const { data: administrator, error } = await supabase
    .from("platform_admins")
    .select("role")
    .eq("user_id", userData.user.id)
    .single()

  if (
    error ||
    !administrator ||
    !["owner", "admin"].includes(administrator.role)
  ) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div>
            <Link href="/admin" className="text-lg font-semibold">
              TGS Administration
            </Link>

            <p className="text-sm text-gray-500">Third Generation Studios</p>
          </div>

          <div className="flex items-center gap-4">
            <span className="rounded-md border px-3 py-1 text-sm capitalize">
              Platform {administrator.role}
            </span>

            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:underline">
              CRM
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
    </div>
  )
}
