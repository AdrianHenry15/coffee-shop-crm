"use server"

import { redirect } from "next/navigation"
import { createClient } from "../lib/supabase/server"

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    redirect("/login?error=missing-fields")
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect("/login?error=invalid-credentials")
  }

  redirect("/dashboard")
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || password.length < 8) {
    redirect("/signup?error=invalid-input")
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm`,
    },
  })

  if (error) {
    redirect("/signup?error=signup-failed")
  }

  redirect("/login?message=check-email")
}

export async function logout() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect("/login")
}
