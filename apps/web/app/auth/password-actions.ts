"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"
import { getAuthConfig } from "@/app/lib/auth/config"
import { readCaptchaToken } from "@/app/lib/auth/captcha"

export type PasswordActionResult = {
  error?: string
  message?: string
}

function readText(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

export async function requestPasswordReset(
  formData: FormData,
): Promise<PasswordActionResult> {
  const email = readText(formData, "email").trim()

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { error: "Enter a valid email address." }
  }

  const captcha = readCaptchaToken(formData)

  if (!captcha.success) {
    return { error: captcha.message }
  }

  const { siteUrl } = getAuthConfig()
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm`,
    captchaToken: captcha.token,
  })

  if (error) {
    if (error.code === "captcha_failed") {
      return {
        error:
          "Verification failed or expired. Complete the new check and try again.",
      }
    }

    if (error.status === 429) {
      return {
        error: "Too many requests. Please wait before trying again.",
      }
    }
    console.error("Password reset request failed:", {
      code: error.code,
      status: error.status,
    })
  }

  // Keep the response the same whether the account exists or not.
  return {
    message:
      "If an account exists for that email, you’ll receive a password reset link. Check your inbox and spam folder.",
  }
}

export async function resetPassword(
  formData: FormData,
): Promise<PasswordActionResult> {
  const password = readText(formData, "password")
  const confirmPassword = readText(formData, "confirmPassword")

  if (password.length < 8 || password.length > 128) {
    return { error: "Use a password containing 8–128 characters." }
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." }
  }

  const supabase = await createClient()

  const { data, error: authError } = await supabase.auth.getUser()

  if (authError || !data.user) {
    return {
      error: "Your session has expired. Request a new password reset link.",
    }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    if (error.code === "same_password") {
      return { error: "Choose a password different from your current one." }
    }

    if (error.code === "weak_password") {
      return { error: "Choose a stronger password and try again." }
    }

    console.error("Password update failed:", {
      code: error.code,
      status: error.status,
    })

    return {
      error:
        "Unable to update your password. Try again or request a new reset link.",
    }
  }

  revalidatePath("/", "layout")

  return { message: "Your password has been updated successfully." }
}
