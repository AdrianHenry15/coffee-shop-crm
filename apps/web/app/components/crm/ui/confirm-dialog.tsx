"use client"

import { useEffect, useRef } from "react"

type Props = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  pending?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()

    return () => previousFocus?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="w-full max-w-md space-y-5 rounded-xl border bg-white p-6 shadow-xl dark:bg-gray-950"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !pending) {
            onCancel()
          }

          if (event.key === "Tab") {
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            )

            const first = buttons[0]
            const last = buttons[buttons.length - 1]

            if (!first || !last) return

            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first.focus()
            }
          }
        }}>
        <div className="space-y-2">
          <h2 id="confirm-title" className="text-lg font-semibold">
            {title}
          </h2>

          <p id="confirm-description" className="text-sm text-gray-500">
            {description}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
            Cancel
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {pending ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
