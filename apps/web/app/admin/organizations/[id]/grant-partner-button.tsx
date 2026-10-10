"use client"

import { useState, useTransition } from "react"
import { grantPartner } from "../actions"

export function GrantPartnerButton({
  organizationId,
}: {
  organizationId: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleGrant() {
    setError(null)

    startTransition(async () => {
      const result = await grantPartner(organizationId)

      if (result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleGrant}
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {pending ? "Granting..." : "Grant Partner"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
