import { createClient } from "@/app/lib/supabase/server"
import { redirect, notFound } from "next/navigation"

export async function getOrganization(slug: string) {
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    redirect("/login")
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("id, name, slug, timezone, email, phone, website, address")
    .eq("slug", slug)
    .single()

  if (error || !organization) {
    notFound()
  }

  return organization
}
