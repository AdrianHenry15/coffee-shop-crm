"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { upgradeToPro } from "./upgrade-actions"

type UpgradeButtonProps = {
  slug: string
  enabled?: boolean
}

export function UpgradeButton({ slug, enabled = false }: UpgradeButtonProps) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleUpgrade() {
    if (!enabled || loading) return

    setLoading(true)
    setError(null)
    setPaymentUrl(null)
    setPending(false)

    try {
      const result = await upgradeToPro(slug)

      if (result.paymentStatus === "paid") {
        router.refresh()
        return
      }

      if (result.paymentStatus === "requires_payment" && result.paymentUrl) {
        setPaymentUrl(result.paymentUrl)
        return
      }

      setPending(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process upgrade")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={!enabled || loading || pending || Boolean(paymentUrl)}
        className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? "Processing..." : "Upgrade to Pro"}
      </button>

      {!enabled && (
        <p className="text-sm text-gray-500">
          Pro upgrades are being prepared.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {paymentUrl && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            Additional payment confirmation is required.
          </p>

          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border border-emerald-900 px-4 py-2 text-sm font-medium text-emerald-900">
            Complete payment with Stripe
          </a>
        </div>
      )}

      {pending && (
        <p role="status" className="text-sm text-gray-600">
          Your upgrade is pending confirmation. Your current Starter plan
          remains active until payment is verified.
        </p>
      )}

      {(pending || paymentUrl) && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Refresh billing status
        </button>
      )}
    </div>
  )
}
