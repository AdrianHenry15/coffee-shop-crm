"use client"

import { useState, useTransition } from "react"
import { updateEstimateItems } from "@/app/org/[slug]/estimates/actions"

type Item = {
  description: string
  quantity: number
  unitPriceCents: number
}

type Props = {
  slug: string
  estimateId: string
  initialItems: Item[]
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

export function EstimateItemEditor({ slug, estimateId, initialItems }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

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
    <section className="space-y-5 rounded-lg border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Edit Services</h2>

        <button
          type="button"
          onClick={addItem}
          disabled={pending || items.length >= 100}
          className="rounded-md border px-3 py-2 text-sm">
          + Add Service
        </button>
      </div>

      {items.map((item, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-md border p-4 sm:grid-cols-12">
          <div className="space-y-1 sm:col-span-5">
            <label className="text-sm">Description</label>

            <input
              value={item.description}
              disabled={pending}
              maxLength={500}
              onChange={(event) =>
                updateItem(index, "description", event.target.value)
              }
              className="w-full rounded-md border p-2"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm">Quantity</label>

            <input
              type="number"
              min={1}
              step={1}
              value={item.quantity}
              disabled={pending}
              onChange={(event) =>
                updateItem(index, "quantity", Number(event.target.value))
              }
              className="w-full rounded-md border p-2"
            />
          </div>

          <div className="space-y-1 sm:col-span-3">
            <label className="text-sm">Price ($)</label>

            <input
              type="number"
              min={0}
              step="0.01"
              value={item.unitPriceCents / 100}
              disabled={pending}
              onChange={(event) =>
                updateItem(
                  index,
                  "unitPriceCents",
                  Math.round(Number(event.target.value) * 100),
                )
              }
              className="w-full rounded-md border p-2"
            />
          </div>

          <div className="flex items-end sm:col-span-2">
            <button
              type="button"
              disabled={pending || items.length === 1}
              onClick={() => removeItem(index)}
              className="w-full rounded-md border px-3 py-2 text-sm text-red-600 disabled:opacity-40">
              Remove
            </button>
          </div>

          <div className="text-right text-sm sm:col-span-12">
            {formatMoney(item.quantity * item.unitPriceCents)}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between border-t pt-4">
        <span className="font-semibold">Total</span>

        <span className="text-xl font-bold">{formatMoney(totalCents)}</span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {saved && (
        <p role="status" className="text-sm text-green-600">
          Estimate updated successfully.
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={saveItems}
        className="rounded-md bg-black px-5 py-3 text-white disabled:opacity-50">
        {pending ? "Saving..." : "Save Changes"}
      </button>
    </section>
  )
}
