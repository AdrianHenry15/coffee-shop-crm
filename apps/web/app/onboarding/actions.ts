"use server"

import { redirect } from "next/navigation"
import { createClient } from "../lib/supabase/server"

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim()

  if (!name || name.length > 100) {
    redirect("/onboarding?error=invalid-name")
  }

  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "")

  if (!slug) {
    redirect("/onboarding?error=invalid-name")
  }

  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    redirect("/login")
  }

  const { error } = await supabase.rpc("create_organization", {
    org_name: name,
    org_slug: slug,
  })

  if (error) {
    if (error.code === "23505") {
      redirect("/onboarding?error=slug-taken")
    }

    redirect("/onboarding?error=creation-failed")
  }

  redirect("/dashboard")
}
