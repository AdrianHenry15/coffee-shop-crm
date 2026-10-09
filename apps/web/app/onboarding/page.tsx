import { redirect } from "next/navigation"
import { createOrganization } from "./actions"
import { logout } from "@/app/auth/actions"
import { createClient } from "../lib/supabase/server"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    redirect("/login")
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .limit(1)

  if (membershipError) {
    throw new Error("Unable to load organization membership.")
  }

  if (memberships?.length) {
    redirect("/dashboard")
  }

  const errorMessages: Record<string, string> = {
    "invalid-name": "Enter a valid business name.",
    "slug-taken": "A business with this URL name already exists.",
    "creation-failed": "Unable to create your organization. Try again.",
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Create your workspace</h1>

          <p className="mt-2 text-gray-500">
            Enter your business name to get started with CoffeeShopCRM.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessages[error] ?? "Something went wrong."}
          </p>
        )}

        <form action={createOrganization} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm">
              Business name
            </label>

            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              placeholder="Third Generation Studios"
              className="w-full rounded-md border p-3"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-black p-3 text-white">
            Create workspace
          </button>
        </form>

        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 underline">
            Log out
          </button>
        </form>
      </div>
    </main>
  )
}
