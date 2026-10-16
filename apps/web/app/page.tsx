import Link from "next/link"
import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"

export const metadata: Metadata = {
  title: "CoffeeShopCRM | Run your business, simply",
  description:
    "Organize leads, customers, estimates, and jobs in one simple workspace. Get started with CoffeeShopCRM for free.",
}

const features = [
  {
    number: "01",
    title: "Leads",
    description:
      "Keep track of potential customers and turn opportunities into relationships.",
  },
  {
    number: "02",
    title: "Customers",
    description:
      "Keep customer information and activity organized in one place.",
  },
  {
    number: "03",
    title: "Estimates",
    description:
      "Create estimates, manage line items, and track their progress.",
  },
  {
    number: "04",
    title: "Jobs",
    description: "Manage ongoing work and keep your business moving forward.",
  },
]

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Get organized without spending a dime.",
    highlight: false,
  },
  {
    name: "Starter",
    price: "$24",
    description: "More room for a growing business.",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$59",
    description: "Built for businesses ready to scale.",
    highlight: false,
  },
]

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image
              src="/branding/icons/app-icon-minimal.png"
              alt=""
              width={48}
              height={48}
              className="h-11 w-11 object-contain"
              priority
            />

            <span className="font-mono text-lg font-bold tracking-tight sm:text-xl">
              CoffeeShop<span className="text-primary">CRM</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-secondary">
              Log in
            </Link>

            <Link
              href="/signup"
              className="hidden rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-6 py-24 sm:py-32">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-8 inline-flex rounded-full border border-border bg-surface px-4 py-2 font-mono text-xs font-medium text-primary">
              YOUR BUSINESS. BETTER ORGANIZED.
            </div>

            <h1 className="mx-auto max-w-4xl text-5xl leading-tight font-bold tracking-tight sm:text-7xl">
              Less busywork.
              <br />
              <span className="text-primary">More business.</span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted">
              Your leads, customers, estimates, and jobs belong in one organized
              workspace. Spend less time managing information and more time
              growing your business.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-xl bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                Get started free →
              </Link>

              <a
                href="#features"
                className="rounded-xl border border-border bg-surface px-7 py-4 text-sm font-semibold hover:bg-surface-secondary">
                Explore features
              </a>
            </div>

            <p className="mt-5 text-xs text-muted">
              Start free. Upgrade when your business needs more.
            </p>
          </div>
        </section>

        {/* Feature section */}
        <section
          id="features"
          className="border-y border-border bg-surface-secondary px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl">
              <p className="mb-4 font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                The essentials
              </p>

              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything in its place.
              </h2>

              <p className="mt-4 text-muted">
                The tools your business needs, without the clutter you
                don&apos;t.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {features.map((feature) => (
                <article
                  key={feature.number}
                  className="rounded-2xl border border-border bg-surface p-8">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {feature.number} / 04
                  </span>

                  <h3 className="mt-8 text-2xl font-semibold">
                    {feature.title}
                  </h3>

                  <p className="mt-3 max-w-md leading-relaxed text-muted">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <p className="mb-4 font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                Simple pricing
              </p>

              <h2 className="text-3xl font-bold sm:text-4xl">
                Start small. Grow big.
              </h2>

              <p className="mt-4 text-muted">
                Straightforward plans for every stage of business.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`flex flex-col rounded-2xl border p-8 ${
                    plan.highlight
                      ? "border-primary bg-surface shadow-lg"
                      : "border-border bg-surface"
                  }`}>
                  <div className="flex min-h-7 items-center justify-between">
                    <h3 className="font-mono text-lg font-semibold">
                      {plan.name}
                    </h3>

                    {plan.highlight && (
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        Popular
                      </span>
                    )}
                  </div>

                  <div className="mt-8">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="ml-2 text-sm text-muted">/ month</span>
                  </div>

                  <p className="mt-5 min-h-14 text-sm leading-relaxed text-muted">
                    {plan.description}
                  </p>

                  <Link
                    href="/signup"
                    className={`mt-8 block rounded-xl px-5 py-3 text-center text-sm font-semibold ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground"
                        : "border border-border hover:bg-surface-secondary"
                    }`}>
                    Get started
                  </Link>
                </article>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted">
              Plan limits and included features are shown during signup.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-sidebar px-6 py-20 text-sidebar-foreground">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold sm:text-5xl">
              Ready to get organized?
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-sidebar-muted">
              Build a better workflow for your business, one customer at a time.
            </p>

            <Link
              href="/signup"
              className="mt-8 inline-flex rounded-xl bg-white px-7 py-4 text-sm font-semibold text-[#12372a] hover:bg-[#edf2ed]">
              Create your free workspace →
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} CoffeeShopCRM</span>

          <span>
            Built by{" "}
            <a
              href="https://thirdgenerationstudios.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline">
              Third Generation Studios
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
