import { NextResponse } from "next/server"
import { createAdminClient } from "@/app/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const responseHeaders = {
  "Cache-Control": "private, no-store",
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: responseHeaders },
    )
  }

  try {
    const admin = createAdminClient()

    const { error } = await admin
      .from("organization_subscriptions")
      .select("organization_id")
      .limit(1)

    if (error) {
      console.error("Supabase activity check failed:", error)

      return NextResponse.json(
        { error: "Database check failed" },
        { status: 503, headers: responseHeaders },
      )
    }

    return NextResponse.json({ ok: true }, { headers: responseHeaders })
  } catch (error) {
    console.error("Supabase activity check failed:", error)

    return NextResponse.json(
      { error: "Database check failed" },
      { status: 503, headers: responseHeaders },
    )
  }
}
