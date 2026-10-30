import { NextResponse } from "next/server"
import { createAdminClient } from "@/app/lib/supabase/admin"
import { cleanupCatalogImages } from "@/app/lib/catalog/cleanup-images"

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
      throw new Error("Database activity check failed.", { cause: error })
    }

    const cleanup = await cleanupCatalogImages(admin)

    return NextResponse.json(
      {
        ok: true,
        catalogImagesCleaned: cleanup.completed,
      },
      { headers: responseHeaders },
    )
  } catch (error) {
    console.error("Scheduled database maintenance failed:", error)

    return NextResponse.json(
      { error: "Scheduled maintenance failed" },
      { status: 503, headers: responseHeaders },
    )
  }
}
