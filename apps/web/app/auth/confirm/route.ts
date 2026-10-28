import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/app/lib/supabase/server"
import { getAuthConfig } from "@/app/lib/auth/config"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const { siteUrl } = getAuthConfig()

  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  if (
    tokenHash &&
    (type === "signup" || type === "email" || type === "recovery")
  ) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (!error) {
      const destination = type === "recovery" ? "/reset-password" : "/dashboard"

      const response = NextResponse.redirect(new URL(destination, siteUrl))

      response.headers.set("Cache-Control", "private, no-store")
      response.headers.set("Referrer-Policy", "no-referrer")

      return response
    }
  }

  const destination =
    type === "recovery"
      ? "/forgot-password?error=recovery"
      : "/login?error=confirmation"

  const response = NextResponse.redirect(new URL(destination, siteUrl))

  response.headers.set("Cache-Control", "private, no-store")
  response.headers.set("Referrer-Policy", "no-referrer")

  return response
}
