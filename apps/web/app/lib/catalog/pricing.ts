import "server-only"

import type { CatalogPriceMode } from "./types"

type PricingResult =
  | {
      success: true
      pricing: {
        price_mode: CatalogPriceMode
        price_cents: number | null
        currency: "USD"
      }
    }
  | {
      success: false
      error: string
    }

export function readCatalogPricing(formData: FormData): PricingResult {
  const mode = String(formData.get("priceMode") ?? "")

  if (mode !== "quote" && mode !== "fixed" && mode !== "starting_at") {
    return {
      success: false,
      error: "Choose a valid pricing option.",
    }
  }

  if (mode === "quote") {
    return {
      success: true,
      pricing: {
        price_mode: "quote",
        price_cents: null,
        currency: "USD",
      },
    }
  }

  const amount = String(formData.get("priceAmount") ?? "").trim()

  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(amount)) {
    return {
      success: false,
      error:
        "Enter a price from 0 to 999,999,999.99 with up to two decimal places.",
    }
  }

  const [dollars, fraction = ""] = amount.split(".")

  // Parse the decimal parts separately to avoid rounding errors.
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"))

  return {
    success: true,
    pricing: {
      price_mode: mode,
      price_cents: cents,
      currency: "USD",
    },
  }
}
