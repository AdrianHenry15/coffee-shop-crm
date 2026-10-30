"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { login, signup } from "@/app/auth/actions"
import Link from "next/link"
import { AuthCaptcha } from "@/app/components/auth/auth-captcha"

type Props = {
  mode: "login" | "signup"
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

export function AuthForm({ mode }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [captchaVersion, setCaptchaVersion] = useState(0)

  const isSignup = mode === "signup"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pending) return

    setError(null)
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      try {
        const result = await (isSignup ? signup(formData) : login(formData))

        if (result.error) {
          setError(result.error)
        } else if (result.redirectTo) {
          router.replace(result.redirectTo)
          router.refresh()
        }
      } catch {
        setError("Unable to process your request. Please try again.")
      } finally {
        setCaptchaVersion((version) => version + 1)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">
          {isSignup ? "Create your account" : "Log in"}
        </legend>

        {isSignup && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-foreground">
                First name
              </label>

              <input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                required
                maxLength={100}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-foreground">
                Last name
              </label>

              <input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                required
                maxLength={100}
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground">
            {isSignup ? "Personal account email" : "Email"}
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

          {isSignup && (
            <p className="text-xs text-muted">
              Used to sign in. You’ll enter your business contact email when
              creating your workspace.
            </p>
          )}
        </div>

        {isSignup && (
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-foreground">
              Personal phone number
            </label>

            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={50}
              className={inputClass}
            />

            <p className="text-xs text-muted">
              Private to your account. This is separate from your business phone
              number.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground">
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
            maxLength={128}
            className={inputClass}
          />

          {isSignup && (
            <p className="text-xs text-muted">Use at least 8 characters.</p>
          )}
        </div>

        {isSignup && (
          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-foreground">
              Confirm password
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
        )}
      </fieldset>

      <AuthCaptcha
        key={captchaVersion}
        action={isSignup ? "signup" : "login"}
      />

      {!isSignup && (
        <Link
          href="/forgot-password"
          className="block text-right text-sm font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Please wait..." : isSignup ? "Create account" : "Log in"}
      </button>
    </form>
  )
}
