import { redirect } from "next/navigation"
import { logout } from "@/app/auth/actions"
import { createClient } from "../lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect("/login")
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .limit(1)

  if (membershipError) {
    throw new Error("Unable to load organization membership.")
  }

  if (!memberships?.length) {
    redirect("/onboarding")
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-semibold">CoffeeShopCRM Dashboard</h1>

      <p className="mt-4 text-gray-600">Signed in as {data.user.email}</p>

      <form action={logout} className="mt-8">
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-white">
          Log out
        </button>
      </form>
    </main>
  )
}
