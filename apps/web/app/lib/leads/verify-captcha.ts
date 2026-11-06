import "server-only"

import { getAuthConfig } from "@/app/lib/auth/config"

export async function verifyLeadCaptcha(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  if (!secret) {
    throw new Error("Missing public lead CAPTCHA configuration.")
  }

  const expectedHostname = new URL(getAuthConfig().siteUrl).hostname

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret,
        response: token,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    },
  )

  if (!response.ok) {
    throw new Error("CAPTCHA verification is unavailable.")
  }

  const result: unknown = await response.json()

  return (
    typeof result === "object" &&
    result !== null &&
    "success" in result &&
    result.success === true &&
    "action" in result &&
    result.action === "lead_capture" &&
    "hostname" in result &&
    result.hostname === expectedHostname
  )
}
