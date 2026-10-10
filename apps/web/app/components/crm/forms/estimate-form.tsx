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

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"

const secondaryButton =
  "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40"

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
        <label
          htmlFor="customerId"
          className="block text-sm font-medium text-foreground">
          Customer
        </label>

        <select
          id="customerId"
          name="customerId"
          required
          defaultValue=""
          className={inputClass}>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-mono text-base font-semibold text-foreground">
              Services
            </h3>
            <p className="mt-1 text-xs text-muted">
              Add services, quantities, and pricing.
            </p>
          </div>

          <button
            type="button"
            disabled={items.length >= 100}
            onClick={() => setItems((current) => [...current, emptyItem()])}
            className={secondaryButton}>
            + Add service
          </button>
        </div>

        {items.map((item, index) => (
          <div
            key={index}
            className="grid gap-4 rounded-xl border border-border bg-surface-secondary p-4 sm:grid-cols-12">
            <div className="space-y-2 sm:col-span-5">
              <label
                htmlFor={`service-description-${index}`}
                className="block text-sm font-medium text-foreground">
                Description
              </label>

              <input
                id={`service-description-${index}`}
                required
                maxLength={500}
                value={item.description}
                onChange={(event) =>
                  updateItem(index, "description", event.target.value)
                }
                placeholder="Exterior cleaning"
                className={inputClass}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor={`service-quantity-${index}`}
                className="block text-sm font-medium text-foreground">
                Quantity
              </label>

              <input
                id={`service-quantity-${index}`}
                type="number"
                min={1}
                step={1}
                required
                value={item.quantity}
                onChange={(event) =>
                  updateItem(index, "quantity", Number(event.target.value))
                }
                className={inputClass}
              />
            </div>

            <div className="space-y-2 sm:col-span-3">
              <label
                htmlFor={`service-price-${index}`}
                className="block text-sm font-medium text-foreground">
                Unit price ($)
              </label>

              <input
                id={`service-price-${index}`}
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
                className={inputClass}
              />
            </div>

            <div className="flex items-end sm:col-span-2">
              <button
                type="button"
                disabled={items.length === 1}
                onClick={() => removeItem(index)}
                className="w-full rounded-lg border border-red-500/20 px-3 py-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-40">
                Remove
              </button>
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

      <div className="space-y-2">
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-foreground">
          Notes
        </label>

        <textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Additional estimate details..."
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface-secondary p-5">
        <div>
          <p className="font-mono text-sm font-semibold text-foreground">
            Estimate total
          </p>
          <p className="mt-1 text-xs text-muted">
            Calculated from all services
          </p>
        </div>

        <span className="font-mono text-2xl font-semibold text-primary">
          {formatMoney(totalCents)}
        </span>
      </div>

      <div className="flex justify-end border-t border-border pt-5">
        <button
          type="submit"
          disabled={customers.length === 0}
          className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
          Save draft estimate
        </button>
      </div>
    </form>
  )
}
