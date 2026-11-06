"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"

export async function acceptLegalDocuments(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  if (formData.get("acceptTerms") !== "yes") {
    redirect("/legal/accept?error=required")
  }

  const termsVersion = formData.get("termsVersion")
  const privacyVersion = formData.get("privacyVersion")

  if (termsVersion !== "2026-11-03" || privacyVersion !== "2026-11-03") {
    redirect("/legal/accept?error=version")
  }

  const { error } = await supabase.rpc("accept_current_legal_documents", {
    p_terms_version: termsVersion,
    p_privacy_version: privacyVersion,
  })

  if (error) {
    redirect("/legal/accept?error=save")
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}
