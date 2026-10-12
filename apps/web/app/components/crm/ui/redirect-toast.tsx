"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

type Props = {
  messages: Record<string, string>
}

export function RedirectToast({ messages }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const success = searchParams.get("success")
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (!success || handled.current === success) return

    const message = messages[success]
    if (!message) return

    handled.current = success

    toast.success(message, {
      id: `redirect-${success}`,
    })

    const params = new URLSearchParams(searchParams.toString())
    params.delete("success")

    const query = params.toString()

    router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    })
  }, [success, messages, router, searchParams])

  return null
}
