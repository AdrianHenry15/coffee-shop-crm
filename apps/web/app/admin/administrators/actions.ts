"use server"

import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type AdministratorActionResult = {
  success: boolean
  message: string
}

export async function grantAdministrator(
  formData: FormData,
): Promise<AdministratorActionResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return {
      success: false,
      message: "Enter a valid registered account email.",
    }
  }

  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return {
      success: false,
      message: "Your session has expired. Sign in again.",
    }
  }

  // The RPC independently enforces platform owner permissions.
  const { error } = await supabase.rpc("grant_platform_administrator", {
    p_email: email,
  })

  if (error) {
    console.error("Unable to grant platform administrator access:", error)

    return {
      success: false,
      message:
        error.code === "42501" || error.code === "22023"
          ? error.message
          : "Unable to grant administrator access.",
    }
  }

  revalidatePath("/admin/administrators")

  return {
    success: true,
    message: `Administrator access granted to ${email}.`,
  }
}

export async function revokeAdministrator(
  formData: FormData,
): Promise<AdministratorActionResult> {
  const userId = String(formData.get("userId") ?? "")

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    return {
      success: false,
      message: "Invalid administrator account.",
    }
  }

  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return {
      success: false,
      message: "Your session has expired. Sign in again.",
    }
  }

  const { data: removed, error } = await supabase.rpc(
    "revoke_platform_administrator",
    {
      p_user_id: userId,
    },
  )

  if (error) {
    console.error("Unable to revoke platform administrator access:", error)

    return {
      success: false,
      message:
        error.code === "42501" || error.code === "22023"
          ? error.message
          : "Unable to remove administrator access.",
    }
  }

  revalidatePath("/admin/administrators")

  return {
    success: true,
    message: removed
      ? "Administrator access removed. The user’s account and workspace memberships remain."
      : "This user no longer has platform administrator access.",
  }
}
