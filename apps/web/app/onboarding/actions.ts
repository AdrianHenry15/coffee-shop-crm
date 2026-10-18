"use server"

import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type OnboardingResult = {
  error?: string
  redirectTo?: string
}

function readText(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

export async function createOrganization(
  formData: FormData,
): Promise<OnboardingResult> {
  const name = readText(formData, "name")
  const email = readText(formData, "email")
  const phone = readText(formData, "phone")
  const rawWebsite = readText(formData, "website")
  const address = readText(formData, "address")
  const timezone = readText(formData, "timezone")

  if (!name || name.length > 100) {
    return { error: "Enter a business name up to 100 characters." }
  }

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { error: "Enter a valid business email." }
  }

  const phoneDigits = phone.replace(/\D/g, "")

  if (
    phone &&
    (phone.length > 50 || phoneDigits.length < 7 || phoneDigits.length > 15)
  ) {
    return {
      error: "Enter a business phone number containing 7–15 digits.",
    }
  }

  if (address.length > 1000) {
    return { error: "Business address must be 1,000 characters or fewer." }
  }

  if (!timezone || timezone.length > 100) {
    return { error: "Select your business timezone." }
  }

  let website = ""

  if (rawWebsite) {
    try {
      const candidate = /^[a-z][a-z0-9+.-]*:/i.test(rawWebsite)
        ? rawWebsite
        : `https://${rawWebsite}`

      const url = new URL(candidate)

      if (
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.href.length > 2048
      ) {
        return { error: "Enter a valid business website." }
      }

      website = url.href
    } catch {
      return { error: "Enter a valid business website." }
    }
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
    return {
      error: "Use a business name that can form a workspace URL.",
    }
  }

  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "Your session has expired. Sign in again." }
  }

  if (!authData.user.email_confirmed_at) {
    return { error: "Confirm your account email before continuing." }
  }

  const { error } = await supabase.rpc("onboard_organization", {
    p_name: name,
    p_slug: slug,
    p_email: email,
    p_phone: phone,
    p_website: website,
    p_address: address,
    p_timezone: timezone,
  })

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "That workspace URL is already taken. Add a location or another distinguishing word to your business name.",
      }
    }

    if (error.code === "22023" || error.code === "42501") {
      return { error: error.message }
    }

    console.error("Unable to complete organization onboarding:", error)

    return {
      error: "Unable to create your workspace. Please try again.",
    }
  }

  revalidatePath("/", "layout")

  return { redirectTo: "/dashboard" }
}
