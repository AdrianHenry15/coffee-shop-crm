"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"
import { getAuthConfig } from "@/app/lib/auth/config"
import type { AccountActionResult } from "./actions"

function readText(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

export async function requestEmailChange(
  formData: FormData,
): Promise<AccountActionResult> {
  const email = readText(formData, "newEmail").trim()
  const confirmEmail = readText(formData, "confirmEmail").trim()
  const password = readText(formData, "currentPassword")

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { success: false, message: "Enter a valid email address." }
  }

  if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
    return { success: false, message: "Email addresses do not match." }
  }

  if (!password || password.length > 128) {
    return { success: false, message: "Enter your current password." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  const user = authData.user

  if (authError || !user?.email) {
    return {
      success: false,
      message: "Your session has expired. Sign in again.",
    }
  }

  if (email.toLowerCase() === user.email.toLowerCase()) {
    return {
      success: false,
      message: "Enter a different email address.",
    }
  }

  // Use the server-verified account email, never a submitted user ID.
  const { data: verified, error: passwordError } =
    await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })

  if (passwordError) {
    return {
      success: false,
      message:
        passwordError.status === 429
          ? "Too many attempts. Please wait before trying again."
          : "Unable to verify your current password.",
    }
  }

  if (verified.user?.id !== user.id) {
    return {
      success: false,
      message: "Unable to verify your account. Sign in again.",
    }
  }

  const { siteUrl } = getAuthConfig()

  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${siteUrl}/auth/confirm` },
  )

  if (error) {
    console.error("Email change request failed:", {
      code: error.code,
      status: error.status,
    })

    return {
      success: false,
      message:
        error.status === 429
          ? "Too many requests. Please wait before trying again."
          : "Unable to request this email change. Check the address and try again.",
    }
  }

  revalidatePath("/account")

  return {
    success: true,
    message:
      "Check both your current and new inboxes. Confirm both emails to complete the change. Your existing login email remains active until then.",
  }
}
