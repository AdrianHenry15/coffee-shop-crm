"use client"

import { useState } from "react"
import { createEstimate } from "@/app/org/[slug]/estimates/actions"

type Customer = {
  id: string
  name: string
}

type Item = {
  description: string
  quantity: number
  unitPriceCents: number
}

type Props = {
  slug: string
  customers: Customer[]
}

const emptyItem = (): Item => ({
  description: "",
  quantity: 1,
  unitPriceCents: 0,
})

export function EstimateForm({ slug, customers }: Props) {
  const [items, setItems] = useState<Item[]>([emptyItem()])
  const [notes, setNotes] = useState("")

  function updateItem(
    index: number,
    field: keyof Item,
    value: string | number,
  ) {
    setItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    )
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index))
  }

  const totalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0,
  )

  const formatMoney = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)

  return (
    <form action={createEstimate} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div className="space-y-2">
        <label htmlFor="customerId" className="text-sm font-medium">
          Customer
        </label>

        <select
          id="customerId"
          name="customerId"
          required
          defaultValue=""
          className="w-full rounded-md border p-3">
          <option value="" disabled>
            Select a customer
          </option>

          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Services</h2>

          <button
            type="button"
            disabled={items.length >= 100}
            onClick={() => setItems((current) => [...current, emptyItem()])}
            className="rounded-md border px-3 py-2 text-sm">
            + Add Service
          </button>
        </div>

        {items.map((item, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border p-4 sm:grid-cols-12">
            <div className="space-y-1 sm:col-span-5">
              <label className="text-sm">Description</label>

              <input
                required
                maxLength={500}
                value={item.description}
                onChange={(event) =>
                  updateItem(index, "description", event.target.value)
                }
                placeholder="Exterior cleaning"
                className="w-full rounded-md border p-2"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm">Quantity</label>

              <input
                type="number"
                min={1}
                step={1}
                required
                value={item.quantity}
                onChange={(event) =>
                  updateItem(index, "quantity", Number(event.target.value))
                }
                className="w-full rounded-md border p-2"
              />
            </div>

            <div className="space-y-1 sm:col-span-3">
              <label className="text-sm">Unit Price ($)</label>

              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={item.unitPriceCents / 100}
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
                disabled={items.length === 1}
                onClick={() => removeItem(index)}
                className="w-full rounded-md border px-3 py-2 text-sm text-red-600 disabled:opacity-40">
                Remove
              </button>
            </div>

            <div className="text-right text-sm font-medium sm:col-span-12">
              Subtotal: {formatMoney(item.quantity * item.unitPriceCents)}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>

        <textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Additional estimate details..."
          className="w-full rounded-md border p-3"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-5">
        <span className="font-semibold">Estimate Total</span>

        <span className="text-2xl font-bold">{formatMoney(totalCents)}</span>
      </div>

      <button
        type="submit"
        disabled={customers.length === 0}
        className="rounded-md bg-black px-5 py-3 text-white disabled:opacity-50">
        Save Draft Estimate
      </button>
    </form>
  )
}
