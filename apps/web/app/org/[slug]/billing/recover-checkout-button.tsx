"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { recoverCheckout } from "./recover-checkout"

export function RecoverCheckoutButton({ slug }: { slug: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)

  async function handleRecover() {
    setPending(true)
    setMessage("")
    setFailed(false)

    try {
      await recoverCheckout(slug)
      setMessage("The paid Starter subscription was recovered.")
      router.refresh()
    } catch (error) {
      setFailed(true)
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not recover the subscription.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRecover}
        disabled={pending}
        className="rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending
          ? "Checking Stripe payment…"
          : "Recover paid Starter subscription"}
      </button>

      {message && (
        <p role={failed ? "alert" : "status"} className="text-sm">
          {message}
        </p>
      )}
    </div>
  )
}
