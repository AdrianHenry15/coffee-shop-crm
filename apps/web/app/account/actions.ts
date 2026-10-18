"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"

export type AccountActionResult = {
  success: boolean
  message: string
}

export async function updateAccount(
  formData: FormData,
): Promise<AccountActionResult> {
  const firstName = String(formData.get("firstName") ?? "").trim()
  const lastName = String(formData.get("lastName") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()

  if (
    !firstName ||
    firstName.length > 100 ||
    !lastName ||
    lastName.length > 100
  ) {
    return {
      success: false,
      message: "First and last names must contain 1–100 characters.",
    }
  }

  const phoneDigits = phone.replace(/\D/g, "")

  if (
    phone &&
    (phone.length > 50 || phoneDigits.length < 7 || phoneDigits.length > 15)
  ) {
    return {
      success: false,
      message: "Enter a phone number containing 7–15 digits.",
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

  const { error } = await supabase.rpc("update_account_details", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_phone: phone,
  })

  if (error) {
    console.error("Unable to update account details:", error)

    return {
      success: false,
      message:
        error.code === "22023"
          ? error.message
          : "Unable to save your account details. Please try again.",
    }
  }

  revalidatePath("/account")
  revalidatePath("/org/[slug]/settings", "page")

  return {
    success: true,
    message: "Your account details have been saved.",
  }
}
