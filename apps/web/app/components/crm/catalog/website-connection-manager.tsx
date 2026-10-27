"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { ConnectionActionResult } from "@/app/org/[slug]/catalog/connections/actions"

type Connection = {
  id: string
  name: string
  enabled: boolean
}

type Props = {
  connections: Connection[]
  onCreate: (formData: FormData) => Promise<ConnectionActionResult>
  onSetEnabled: (
    connectionId: string,
    enabled: boolean,
  ) => Promise<ConnectionActionResult>
  onRotate: (connectionId: string) => Promise<ConnectionActionResult>
  onDelete: (connectionId: string) => Promise<ConnectionActionResult>
}

const buttonClass =
  "rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"

export function WebsiteConnectionManager({
  connections,
  onCreate,
  onSetEnabled,
  onRotate,
  onDelete,
}: Props) {
  const router = useRouter()

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  function runAction(
    operation: () => Promise<ConnectionActionResult>,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    if (pending) return

    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const result = await operation()

        if (result.error) {
          setError(result.error)
          return
        }

        if (result.apiKey) {
          setRevealedKey(result.apiKey)
        }

        setMessage(successMessage)
        onSuccess?.()
        router.refresh()
      } catch {
        setError(
          "The request could not be confirmed. Refresh the page to check the connection before retrying.",
        )
      }
    })
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pending || revealedKey) return

    const form = event.currentTarget
    const formData = new FormData(form)

    runAction(
      () => onCreate(formData),
      "Connection created. Save its key, then enable it when ready.",
      () => form.reset(),
    )
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Add website connection
        </h2>

        <div className="space-y-2">
          <label
            htmlFor="connection-name"
            className="block text-sm font-medium text-foreground">
            Connection name
          </label>

          <input
            id="connection-name"
            name="name"
            required
            maxLength={100}
            disabled={pending || Boolean(revealedKey)}
            placeholder="Eckert production website"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={pending || Boolean(revealedKey)}
          className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Updating..." : "Create connection"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}

      {revealedKey && (
        <section className="space-y-4 rounded-xl border border-primary bg-primary/5 p-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Save your API key
          </h2>

          <p className="text-sm text-muted">
            This key is displayed once. Store it in the website’s server
            environment variables. Keep it out of browser code and public
            repositories.
          </p>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              API key
            </span>

            <textarea
              readOnly
              value={revealedKey}
              rows={3}
              spellCheck={false}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground"
            />
          </label>

          <p className="text-xs text-muted">
            If you lose this key, generate a replacement using Rotate key.
          </p>

          <button
            type="button"
            onClick={() => {
              setRevealedKey(null)
              setMessage(null)
            }}
            className={buttonClass}>
            I’ve saved this key
          </button>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Website connections
        </h2>

        {connections.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
            No website connections yet.
          </p>
        )}

        {connections.map((connection) => (
          <article
            key={connection.id}
            className="space-y-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-medium text-foreground">
                {connection.name}
              </h3>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  connection.enabled
                    ? "bg-primary/10 text-primary"
                    : "bg-surface-secondary text-muted"
                }`}>
                {connection.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  runAction(
                    () =>
                      onSetEnabled(connection.id, !connection.enabled),
                    connection.enabled
                      ? "Connection disabled."
                      : "Connection enabled.",
                  )
                }
                className={buttonClass}>
                {connection.enabled ? "Disable" : "Enable"}
              </button>

              <button
                type="button"
                disabled={pending || Boolean(revealedKey)}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Replace this API key? The current key will stop working, and the website will need the new one.",
                    )
                  ) {
                    return
                  }

                  runAction(
                    () => onRotate(connection.id),
                    "API key replaced. Update the website with the new key.",
                  )
                }}
                className={buttonClass}>
                Rotate key
              </button>

              <button
                type="button"
                disabled={pending || Boolean(revealedKey)}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Permanently delete "${connection.name}" and revoke its API key?`,
                    )
                  ) {
                    return
                  }

                  runAction(
                    () => onDelete(connection.id),
                    "Connection deleted.",
                  )
                }}
                className={buttonClass}>
                Delete connection
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}