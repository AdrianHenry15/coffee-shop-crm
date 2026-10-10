"use client"

import { useState, useTransition } from "react"
import { revokePartner } from "../actions"

type RevokePartnerButtonProps = {
  organizationId: string
  organizationName: string
}

export function RevokePartnerButton({
  organizationId,
  organizationName,
}: RevokePartnerButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRevoke() {
    setError(null)

    startTransition(async () => {
      const result = await revokePartner(organizationId)

      if (result.error) {
        setError(result.error)
        return
      }

      setConfirming(false)
    })
  }

  return (
    <div className="space-y-3">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-red-500/50 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10">
          Revoke Partner
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-red-500/40 p-4">
          <h3 className="font-semibold text-red-500">
            Confirm Partner Revocation
          </h3>

          <p className="text-sm text-foreground/70">
            Revoke Partner benefits for <strong>{organizationName}</strong>?
          </p>

          <p className="text-sm text-foreground/70">
            This will remove Partner and Partner+ benefits, including the
            maintenance agreement. The organization will return to its standard
            subscription limits.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRevoke}
              disabled={pending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "Revoking..." : "Confirm Revocation"}
            </button>

            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
