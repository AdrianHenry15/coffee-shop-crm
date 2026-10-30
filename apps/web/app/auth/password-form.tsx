"use client"

import Link from "next/link"
import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { requestPasswordReset, resetPassword } from "./password-actions"
import { AuthCaptcha } from "@/app/components/auth/auth-captcha"

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

export function PasswordForm({ mode }: { mode: "request" | "reset" }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [captchaVersion, setCaptchaVersion] = useState(0)

  const isReset = mode === "reset"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pending) return

    setError(null)

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      try {
        const result = await (isReset
          ? resetPassword(formData)
          : requestPasswordReset(formData))

        if (result.error) {
          setError(result.error)
          return
        }

        if (result.message) {
          setMessage(result.message)

          if (isReset) {
            router.refresh()
          }
        }
      } catch {
        setError("Unable to process your request. Please try again.")
      } finally {
        setCaptchaVersion((version) => version + 1)
      }
    })
  }

  if (message) {
    return (
      <div className="space-y-5">
        <p role="status" className="text-sm leading-6 text-foreground">
          {message}
        </p>

        <Link
          href={isReset ? "/dashboard" : "/login"}
          className="inline-flex text-sm font-semibold text-primary hover:underline">
          {isReset ? "Continue to dashboard →" : "Back to login"}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">
          {isReset ? "Choose a new password" : "Request a password reset"}
        </legend>

        {isReset ? (
          <>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground">
                New password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                className={inputClass}
              />

              <p className="text-xs text-muted">Use at least 8 characters.</p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-foreground">
                Confirm new password
              </label>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                className={inputClass}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground">
              Account email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className={inputClass}
            />
          </div>
        )}
      </fieldset>

      {!isReset && <AuthCaptcha key={captchaVersion} action="password_reset" />}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        {pending
          ? "Please wait..."
          : isReset
            ? "Update password"
            : "Send reset link"}
      </button>

      <Link
        href={isReset ? "/forgot-password" : "/login"}
        className="block text-center text-sm text-muted hover:text-primary hover:underline">
        {isReset ? "Request a new reset link" : "Back to login"}
      </Link>
    </form>
  )
}
