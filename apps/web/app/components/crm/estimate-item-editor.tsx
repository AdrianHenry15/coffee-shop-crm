"use client"

import { useState, useTransition } from "react"
import { updateEstimateItems } from "@/app/org/[slug]/estimates/actions"
import type { EstimateStatus } from "./managers/estimate-manager"

type Item = {
  description: string
  quantity: number
  unitPriceCents: number
}

type Props = {
  slug: string
  estimateId: string
  initialItems: Item[]
  status: EstimateStatus
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

export function EstimateItemEditor({
  slug,
  estimateId,
  initialItems,
  status,
}: Props) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  const canEdit = status === "draft"

  function updateItem(
    index: number,
    field: keyof Item,
    value: string | number,
  ) {
    setSaved(false)

    setItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    )
  }

  function addItem() {
    setSaved(false)

    setItems((current) => [
      ...current,
      {
        description: "",
        quantity: 1,
        unitPriceCents: 0,
      },
    ])
  }

  function removeItem(index: number) {
    setSaved(false)

    setItems((current) => current.filter((_, i) => i !== index))
  }

  function saveItems() {
    setError("")
    setSaved(false)

    startTransition(async () => {
      try {
        await updateEstimateItems(slug, estimateId, items)
        setSaved(true)
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to update estimate.",
        )
      }
    })
  }

  const totalCents = items.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  )

  return (
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-lg font-semibold text-foreground">
            {canEdit ? "Edit services" : "Services"}
          </h2>

          <p className="mt-1 text-sm text-muted">
            {canEdit
              ? "Update services, quantities, and pricing."
              : "Services are read-only after an estimate leaves draft status."}
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={addItem}
            disabled={pending || items.length >= 100}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-50">
            + Add service
          </button>
        )}
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="grid gap-4 rounded-xl border border-border bg-surface-secondary p-4 sm:grid-cols-12">
            <div className="space-y-2 sm:col-span-5">
              <label
                htmlFor={`edit-description-${index}`}
                className="block text-sm font-medium text-foreground">
                Description
              </label>

              <input
                id={`edit-description-${index}`}
                value={item.description}
                disabled={pending || !canEdit}
                maxLength={500}
                onChange={(event) =>
                  updateItem(index, "description", event.target.value)
                }
                className={inputClass}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor={`edit-quantity-${index}`}
                className="block text-sm font-medium text-foreground">
                Quantity
              </label>

              <input
                id={`edit-quantity-${index}`}
                type="number"
                min={1}
                step={1}
                value={item.quantity}
                disabled={pending || !canEdit}
                onChange={(event) =>
                  updateItem(index, "quantity", Number(event.target.value))
                }
                className={inputClass}
              />
            </div>

            <div className="space-y-2 sm:col-span-3">
              <label
                htmlFor={`edit-price-${index}`}
                className="block text-sm font-medium text-foreground">
                Unit price ($)
              </label>

              <input
                id={`edit-price-${index}`}
                type="number"
                min={0}
                step="0.01"
                value={item.unitPriceCents / 100}
                disabled={pending || !canEdit}
                onChange={(event) =>
                  updateItem(
                    index,
                    "unitPriceCents",
                    Math.round(Number(event.target.value) * 100),
                  )
                }
                className={inputClass}
              />
            </div>

            <div className="flex items-end sm:col-span-2">
              {canEdit && (
                <button
                  type="button"
                  disabled={pending || items.length === 1}
                  onClick={() => removeItem(index)}
                  className="w-full rounded-lg border border-red-500/20 px-3 py-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-40">
                  Remove
                </button>
              )}
            </div>

            <div className="border-t border-border pt-3 text-right sm:col-span-12">
              <span className="mr-3 text-xs text-muted">Subtotal</span>

              <span className="font-mono text-sm font-semibold text-foreground">
                {formatMoney(item.quantity * item.unitPriceCents)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface-secondary p-5">
        <span className="font-mono text-sm font-semibold text-foreground">
          Estimate total
        </span>

        <span className="font-mono text-2xl font-semibold text-primary">
          {formatMoney(totalCents)}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      {saved && (
        <p role="status" className="text-sm text-primary">
          Estimate updated successfully.
        </p>
      )}

      {canEdit && (
        <div className="flex justify-end border-t border-border pt-5">
          <button
            type="button"
            disabled={pending}
            onClick={saveItems}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {pending ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </section>
  )
}
