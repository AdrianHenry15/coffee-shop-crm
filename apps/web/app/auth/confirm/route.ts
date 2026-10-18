import { createClient } from "@/app/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  if (token_hash && (type === "signup" || type === "email")) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (!error) {
      return NextResponse.redirect(new URL("/dashboard", origin))
    }
  }

  return NextResponse.redirect(new URL("/login?error=confirmation", origin))
}
