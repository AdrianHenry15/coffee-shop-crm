import Link from "next/link"
import { signup } from "@/app/auth/actions"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
  }>
}) {
  const { error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-gray-500">
            Get started with CoffeeShopCRM.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error === "invalid-input"
              ? "Enter an email and a password with at least 8 characters."
              : "Unable to create your account. Please try again."}
          </p>
        )}

        <form action={signup} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border p-3"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border p-3"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-black p-3 text-white">
            Create account
          </button>
        </form>

        <p className="text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
