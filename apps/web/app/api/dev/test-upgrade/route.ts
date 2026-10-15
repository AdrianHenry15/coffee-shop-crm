import { NextResponse } from "next/server"
import { createClient } from "@/app/lib/supabase/server"
import { upgradeToPro } from "@/app/org/[slug]/billing/upgrade-actions"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Development only" }, { status: 404 })
  }

  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    )
  }

  const { slug } = await request.json()

  if (typeof slug !== "string" || !slug.trim()) {
    return NextResponse.json(
      { error: "Organization slug required" },
      { status: 400 },
    )
  }

  try {
    // upgradeToPro performs its own organization-owner
    // authorization before changing the subscription.
    const result = await upgradeToPro(slug)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Test upgrade failed:", error)

    return NextResponse.json(
      { error: "Unable to complete test upgrade" },
      { status: 500 },
    )
  }
}
