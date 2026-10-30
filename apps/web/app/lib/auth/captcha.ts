import "server-only"

type CaptchaResult =
  | { success: true; token: string | undefined }
  | { success: false; message: string }

export function readCaptchaToken(formData: FormData): CaptchaResult {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  if (!siteKey) {
    if (process.env.NODE_ENV !== "production") {
      return { success: true, token: undefined }
    }

    console.error("Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY")

    return {
      success: false,
      message:
        "Verification is temporarily unavailable. Please try again later.",
    }
  }

  const value = formData.get("captchaToken")

  if (typeof value !== "string" || !value.trim() || value.length > 2048) {
    return {
      success: false,
      message: "Complete the verification check before continuing.",
    }
  }

  return { success: true, token: value }
}
