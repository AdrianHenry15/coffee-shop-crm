"use client"

import { useState } from "react"
import { Turnstile } from "@marsidev/react-turnstile"

type Props = {
  action: "login" | "signup" | "password_reset" | "email_change"
}

export function AuthCaptcha({ action }: Props) {
  const [error, setError] = useState<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  if (!siteKey) {
    return null
  }

  return (
    <div className="space-y-2">
      <Turnstile
        siteKey={siteKey}
        options={{
          action,
          theme: "auto",
          size: "compact",
          responseField: true,
          responseFieldName: "captchaToken",
          refreshExpired: "auto",
          refreshTimeout: "auto",
          retry: "auto",
        }}
        onSuccess={() => setError(null)}
        onExpire={() =>
          setError("Verification expired. Please complete the refreshed check.")
        }
        onError={() =>
          setError(
            "Verification failed to load. Check your connection and try again.",
          )
        }
        onUnsupported={() =>
          setError(
            "This browser cannot complete verification. Try another browser.",
          )
        }
      />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
