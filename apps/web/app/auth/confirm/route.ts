import { NextResponse, type NextRequest } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"
import { getAuthConfig } from "@/app/lib/auth/config"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const { siteUrl } = getAuthConfig()

  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  function redirectTo(destination: string) {
    const response = NextResponse.redirect(new URL(destination, siteUrl))

    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("Referrer-Policy", "no-referrer")

    return response
  }

  if (
    tokenHash &&
    (type === "signup" ||
      type === "email" ||
      type === "recovery" ||
      type === "email_change")
  ) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (!error) {
      if (type === "email_change") {
        revalidatePath("/account")

        return redirectTo(
          data.session
            ? "/auth/email-change?status=complete"
            : "/auth/email-change?status=pending",
        )
      }

      return redirectTo(type === "recovery" ? "/reset-password" : "/dashboard")
    }
  }

  if (type === "email_change") {
    return redirectTo("/auth/email-change?status=invalid")
  }

  return redirectTo(
    type === "recovery"
      ? "/forgot-password?error=recovery"
      : "/login?error=confirmation",
  )
}
