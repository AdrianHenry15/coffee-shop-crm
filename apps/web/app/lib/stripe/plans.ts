export const STRIPE_PLANS = {
  starter: {
    name: "Starter",
    price: 24,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
  },
  pro: {
    name: "Pro",
    price: 59,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
} as const

export type PaidPlan = keyof typeof STRIPE_PLANS
