"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/app/lib/supabase/server"
import { getAuthConfig } from "@/app/lib/auth/config"
import { readCaptchaToken } from "@/app/lib/auth/captcha"

export type AuthActionResult = {
  error?: string
  redirectTo?: string
}

function readText(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function login(formData: FormData): Promise<AuthActionResult> {
  const email = readText(formData, "email").trim()
  const password = readText(formData, "password")

  if (!validEmail(email) || !password || password.length > 128) {
    return { error: "Enter your email and password." }
  }

  const captcha = readCaptchaToken(formData)

  if (!captcha.success) {
    return { error: captcha.message }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: {
      captchaToken: captcha.token,
    },
  })

  if (error) {
    if (error.code === "captcha_failed") {
      return {
        error:
          "Verification failed or expired. Complete the new check and try again.",
      }
    }
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email before signing in." }
    }

    if (error.status === 429) {
      return {
        error: "Too many attempts. Please wait before trying again.",
      }
    }

    return { error: "Invalid email or password." }
  }

  revalidatePath("/", "layout")

  return { redirectTo: "/dashboard" }
}

export async function signup(formData: FormData): Promise<AuthActionResult> {
  const firstName = readText(formData, "firstName").trim()
  const lastName = readText(formData, "lastName").trim()
  const email = readText(formData, "email").trim()
  const phone = readText(formData, "phone").trim()
  const password = readText(formData, "password")
  const confirmPassword = readText(formData, "confirmPassword")

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." }
  }

  if (
    !firstName ||
    firstName.length > 100 ||
    !lastName ||
    lastName.length > 100
  ) {
    return {
      error: "Enter your first and last names, up to 100 characters each.",
    }
  }

  if (!validEmail(email)) {
    return { error: "Enter a valid email address." }
  }

  const phoneDigits = phone.replace(/\D/g, "")

  if (
    !phone ||
    phone.length > 50 ||
    phoneDigits.length < 7 ||
    phoneDigits.length > 15
  ) {
    return {
      error: "Enter a phone number containing 7–15 digits.",
    }
  }

  if (password.length < 8 || password.length > 128) {
    return {
      error: "Use a password containing 8–128 characters.",
    }
  }

  const captcha = readCaptchaToken(formData)

  if (!captcha.success) {
    return { error: captcha.message }
  }
  const { siteUrl } = getAuthConfig()
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: captcha.token,
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      data: {
        first_name: firstName,
        last_name: lastName,
        contact_phone: phone,
      },
    },
  })

  if (error) {
    if (error.status === 429) {
      return {
        error: "Too many attempts. Please wait before trying again.",
      }
    }

    return {
      error:
        "Unable to create your account. Check your details or try signing in if you already registered.",
    }
  }

  if (data.session) {
    revalidatePath("/", "layout")
    return { redirectTo: "/dashboard" }
  }

  return { redirectTo: "/login?message=check-email" }
}

export async function logout() {
  const supabase = await createClient()

  await supabase.auth.signOut()
  revalidatePath("/", "layout")

  redirect("/login")
}
