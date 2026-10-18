import { NextResponse } from "next/server"
import { createAdminClient } from "@/app/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Three small, read-only requests to confirm the production database is reachable.
  const checks = await Promise.all([
    admin.from("organization_subscriptions").select("organization_id").limit(1),
    admin.from("organization_subscriptions").select("organization_id").limit(1),
    admin.from("organization_subscriptions").select("organization_id").limit(1),
  ])

  const failedCheck = checks.find(({ error }) => error)

  if (failedCheck?.error) {
    console.error("Supabase activity check failed:", failedCheck.error)
    return NextResponse.json(
      { error: "Database check failed" },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
