import { redirect } from "next/navigation"
import { logout } from "@/app/auth/actions"
import { createClient } from "../lib/supabase/server"

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect("/login")
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-3xl font-semibold">Welcome to CoffeeShopCRM</h1>

      <p className="mt-4 text-gray-600">
        {`Your account is ready. Next, we'll create your
        organization and configure your workspace.`}
      </p>

      <form action={logout} className="mt-8">
        <button type="submit" className="underline">
          Log out
        </button>
      </form>
    </main>
  )
}
