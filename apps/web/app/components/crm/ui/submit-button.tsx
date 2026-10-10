"use client"

import { useFormStatus } from "react-dom"
import type { ReactNode } from "react"

type Props = {
  children: ReactNode
  pendingLabel?: string
  className?: string
}

export function SubmitButton({
  children,
  pendingLabel = "Saving...",
  className = "",
}: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}>
      {pending ? pendingLabel : children}
    </button>
  )
}
