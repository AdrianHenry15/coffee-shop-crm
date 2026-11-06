import "server-only"

import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"

export async function requireCurrentLegalAcceptance() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const { data: accepted, error } = await supabase.rpc(
    "has_current_legal_acceptance",
  )

  if (error) {
    throw new Error("Unable to verify legal acceptance.")
  }

  if (accepted !== true) {
    redirect("/legal/accept")
  }
}
