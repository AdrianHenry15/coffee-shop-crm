"use client"

import Link from "next/link"
import { useRef, useState, type FormEvent } from "react"
import { AuthCaptcha } from "@/app/components/auth/auth-captcha"

type Props = {
  formId: string
  workspaceName: string
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

export function PublicLeadForm({ formId, workspaceName }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [captchaVersion, setCaptchaVersion] = useState(0)

  const submitting = useRef(false)
  const lastSubmission = useRef<{
    signature: string
    id: string
  } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting.current) return

    const formData = new FormData(event.currentTarget)

    const details = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      message: String(formData.get("message") ?? "").trim(),
    }

    const captchaToken = String(formData.get("captchaToken") ?? "")

    if (!captchaToken) {
      setError("Complete the verification check before sending.")
      return
    }

    const signature = JSON.stringify(details)

    // Preserve the ID when retrying unchanged content.
    // Editing the message creates a new submission.
    if (lastSubmission.current?.signature !== signature) {
      lastSubmission.current = {
        signature,
        id: crypto.randomUUID(),
      }
    }

    submitting.current = true
    setPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/public/lead-forms/${formId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...details,
          submissionId: lastSubmission.current.id,
          captchaToken,
          website: String(formData.get("website") ?? ""),
        }),
        signal: AbortSignal.timeout(25_000),
      })

      const result: unknown = await response.json()

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "message" in result &&
          typeof result.message === "string"
            ? result.message
            : "Unable to send your message. Please try again."

        setError(message)
        return
      }

      setSubmitted(true)
    } catch {
      setError(
        "We couldn't confirm your submission. Complete a new verification check and retry the same message.",
      )
    } finally {
      submitting.current = false
      setPending(false)
      setCaptchaVersion((version) => version + 1)
    }
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="rounded-xl border border-border bg-surface-secondary p-6">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Message received
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your message has been saved for {workspaceName}. They can review your
          inquiry and contact you using the details you provided.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">Your contact details and message</legend>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Your name</span>
          <input
            name="name"
            autoComplete="name"
            required
            maxLength={200}
            className={inputClass}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">
            Email address
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className={inputClass}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">
            Phone number{" "}
            <span className="font-normal text-muted">(optional)</span>
          </span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={50}
            className={inputClass}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">
            How can we help?
          </span>
          <textarea
            name="message"
            required
            maxLength={5000}
            rows={6}
            className={inputClass}
          />
        </label>

        {/* Honeypot: hidden from visitors and assistive technology. */}
        <div hidden aria-hidden="true">
          <label>
            Leave this field blank
            <input
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>
      </fieldset>

      <p className="text-xs leading-relaxed text-muted">
        Your details and message will be shared with {workspaceName} to respond
        to your inquiry. CoffeeShopCRM is operated by Third Generation Studios.
        Read our{" "}
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline">
          Privacy Notice
        </Link>
        . Do not include payment details or sensitive personal information.
      </p>

      <AuthCaptcha key={captchaVersion} action="lead_capture" />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Sending..." : "Send message"}
      </button>
    </form>
  )
}
