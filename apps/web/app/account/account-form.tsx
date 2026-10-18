"use client"

import { useState, useTransition } from "react"
import { updateAccount, type AccountActionResult } from "./actions"

type Props = {
  firstName: string
  lastName: string
  phone: string
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

export function AccountForm({
  firstName: initialFirstName,
  lastName: initialLastName,
  phone: initialPhone,
}: Props) {
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [phone, setPhone] = useState(initialPhone)
  const [result, setResult] = useState<AccountActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  const hasChanges =
    firstName.trim() !== initialFirstName ||
    lastName.trim() !== initialLastName ||
    phone.trim() !== initialPhone

  function saveAccount(formData: FormData) {
    setResult(null)

    startTransition(async () => {
      try {
        const response = await updateAccount(formData)
        setResult(response)
      } catch {
        setResult({
          success: false,
          message: "Unable to save your account details. Please try again.",
        })
      }
    })
  }

  return (
    <form action={saveAccount} className="space-y-6">
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">Personal information</legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-foreground">
              First name
            </label>

            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value)
                setResult(null)
              }}
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
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value)
                setResult(null)
              }}
              required
              maxLength={100}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-foreground">
            Personal phone number{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>

          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              setResult(null)
            }}
            maxLength={50}
            aria-describedby="personal-phone-description"
            className={inputClass}
          />

          <p id="personal-phone-description" className="text-xs text-muted">
            Private to your account. This does not change any workspace’s
            business phone number.
          </p>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          {result && (
            <p
              role={result.success ? "status" : "alert"}
              className={`text-sm ${
                result.success ? "text-primary" : "text-red-600"
              }`}>
              {result.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={
            pending || !hasChanges || !firstName.trim() || !lastName.trim()
          }
          className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Saving..." : "Save account details"}
        </button>
      </div>
    </form>
  )
}
