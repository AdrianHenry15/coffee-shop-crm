import Link from "next/link"
import { login } from "@/app/auth/actions"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}) {
  const { error, message } = await searchParams

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
          <h1 className="text-3xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-500">Log in to CoffeeShopCRM.</p>
        </div>

        {message === "check-email" && (
          <p role="status" className="text-sm text-green-700">
            Check your email to confirm your account.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error === "missing-fields"
              ? "Email and password are required."
              : error === "confirmation"
                ? "That confirmation link is invalid or expired. Try signing up again or request a new confirmation email."
                : "Invalid email or password."}
          </p>
        )}

        <form action={login} className="space-y-4">
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
              autoComplete="current-password"
              className="w-full rounded-md border p-3"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-black p-3 text-white">
            Log in
          </button>
        </form>

        <p className="text-center text-sm">
          New to CoffeeShopCRM?{" "}
          <Link href="/signup" className="underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
