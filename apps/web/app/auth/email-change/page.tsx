import Link from "next/link"

export default async function EmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams

  const complete = status === "complete"
  const pending = status === "pending"

  const title = complete
    ? "Email address updated"
    : pending
      ? "One more confirmation"
      : "Confirmation link unavailable"

  const message = complete
    ? "Your email change is complete. You can now sign in using your new email address."
    : pending
      ? "This confirmation was accepted. Open the email in your other inbox and confirm that link too. Your login email changes after both confirmations."
      : "This link is invalid, expired, or has already been used. Check your account’s current email before requesting another change."

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <h1 className="font-mono text-2xl font-semibold text-foreground">
          {title}
        </h1>

        <p className="text-sm leading-6 text-muted">{message}</p>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/account"
            className="text-sm font-semibold text-primary hover:underline">
            View account
          </Link>

          <Link
            href="/login"
            className="text-sm font-medium text-muted hover:text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
