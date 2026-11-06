import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Coffee,
  Funnel,
  Package,
  UsersRound,
} from "lucide-react"
import { createClient } from "@/app/lib/supabase/server"

export const metadata: Metadata = {
  title: "CoffeeShopCRM | Less busywork. More business.",
  description:
    "Keep leads, customers, estimates, jobs, schedules, and employees organized in one workspace. Start free with CoffeeShopCRM.",
}

const features = [
  {
    icon: Funnel,
    title: "Keep opportunities moving.",
    description:
      "Track potential customers and their progress so your next opportunity stays in view.",
    label: "Leads & customers",
  },
  {
    icon: ClipboardList,
    title: "Put a price on the work.",
    description:
      "Build estimates with line items and track their status. Link an accepted estimate to a customer job.",
    label: "Estimates",
  },
  {
    icon: CalendarDays,
    title: "Know what’s coming up.",
    description:
      "Organize jobs, update their progress, and see scheduled work in your business’s timezone.",
    label: "Jobs & scheduling",
  },
  {
    icon: UsersRound,
    title: "Get the right people on the job.",
    description:
      "Add employees and assign them to work without requiring everyone to create an account.",
    label: "Employees & assignments",
  },
  {
    icon: Package,
    title: "Give your offerings a home.",
    description:
      "Organize products and services with custom fields, images, and reusable catalog templates.",
    label: "Product & service catalog",
  },
  {
    icon: Coffee,
    title: "Make room for your team.",
    description:
      "Invite teammates into your workspace and manage their access with owner, admin, and member roles.",
    label: "Workspace access",
  },
]

const workflow = [
  {
    step: "01",
    title: "Organize the opportunity.",
    description:
      "Keep your leads and customer details together instead of scattered across notes and messages.",
  },
  {
    step: "02",
    title: "Plan the work.",
    description:
      "Create an estimate, track acceptance, and connect it to the job ahead.",
  },
  {
    step: "03",
    title: "Keep things moving.",
    description:
      "Schedule the job, assign employees, and update progress as the work gets done.",
  },
]

const plans = [
  {
    name: "Free",
    price: "$0",
    description:
      "A place to start organizing your business and get familiar with CoffeeShop.",
    audience: "Start with the essentials.",
    highlight: false,
  },
  {
    name: "Starter",
    price: "$24",
    description:
      "More capacity when your customer list and day-to-day workload start growing.",
    audience: "Give your business more room.",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$59",
    description:
      "Higher limits for businesses managing more customers, more work, and a larger team.",
    audience: "Keep up with a busier business.",
    highlight: false,
  },
]

const questions = [
  {
    question: "What is CoffeeShopCRM?",
    answer:
      "It’s a workspace for organizing the people and work behind your business: leads, customers, estimates, jobs, schedules, and employees.",
  },
  {
    question: "Who is it for?",
    answer:
      "CoffeeShop is designed for small businesses that manage customer work, including independent service providers and growing service teams.",
  },
  {
    question: "Does every employee need an account?",
    answer:
      "No. You can add employee records and assign people to jobs without giving them login access. Invite someone separately when they need to use the workspace.",
  },
  {
    question: "Can I start for free?",
    answer:
      "Yes. Create a workspace on the Free plan, then upgrade from your workspace’s billing page when you need more capacity.",
  },
]

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-secondary px-5 py-4">
          <div className="flex items-center gap-2">
            <Coffee aria-hidden="true" className="h-4 w-4 text-primary" />
            <span className="font-mono text-sm font-semibold">
              Your workspace
            </span>
          </div>

          <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            Illustrative preview
          </span>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              A little more organized
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Your next move, in view.
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "New leads", value: "04" },
              { label: "Estimates", value: "03" },
              { label: "Scheduled jobs", value: "06" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-background p-3 sm:p-4">
                <p className="text-[11px] leading-relaxed text-muted">
                  {stat.label}
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold text-primary">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="font-mono text-xs font-semibold">
                From opportunity to getting it done
              </p>
            </div>

            <div className="divide-y divide-border px-4">
              {[
                {
                  icon: Funnel,
                  title: "Patio cleaning inquiry",
                  detail: "Lead · Ready for follow-up",
                  badge: "New",
                },
                {
                  icon: ClipboardList,
                  title: "Weekly property maintenance",
                  detail: "Estimate · Scope and pricing organized",
                  badge: "Draft",
                },
                {
                  icon: CalendarDays,
                  title: "Exterior cleaning",
                  detail: "Job · Two employees assigned",
                  badge: "Scheduled",
                },
              ].map((item) => {
                const Icon = item.icon

                return (
                  <div key={item.title} className="flex items-start gap-3 py-4">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {item.detail}
                      </p>
                    </div>

                    <span className="hidden rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary sm:inline-flex">
                      {item.badge}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            Sample data showing the kind of work you can organize.
          </p>
        </div>
      </div>
    </div>
  )
}

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">
        Skip to content
      </a>

      <div className="border-b border-border bg-primary/10 px-4 py-3 text-center">
        <p className="text-sm text-foreground">
          <span className="font-semibold text-primary">Early access</span>
          {" — "}
          CoffeeShop is still growing. Start free and help shape what comes
          next.
        </p>
      </div>

      <header className="border-b border-border">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/branding/icons/app-icon-minimal.png"
              alt=""
              width={44}
              height={44}
              className="h-9 w-9 object-contain sm:h-11 sm:w-11"
              priority
            />

            <span className="font-mono text-base font-bold tracking-tight sm:text-xl">
              CoffeeShop<span className="text-primary">CRM</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-muted lg:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-2 py-2 text-sm font-medium hover:bg-surface-secondary sm:px-3">
              Log in
            </Link>

            <Link
              href="/signup"
              className="hidden items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex">
              Join early access free
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="px-5 py-16 sm:px-6 sm:py-24 lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 font-mono text-[11px] font-medium text-primary">
                <Coffee aria-hidden="true" className="h-3.5 w-3.5" />A FRESH
                START FOR YOUR BUSINESS
              </p>

              <h1 className="mt-7 text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl xl:text-7xl">
                Less busywork.
                <br />
                <span className="text-primary">More business.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Keep customers, estimates, jobs, and your team organized in one
                place. Spend less time piecing things together and more time
                getting the work done.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                  Join early access free
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-6 py-4 text-sm font-semibold hover:bg-surface-secondary">
                  See how it works
                </a>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-muted">
                Core business tools are available now. Additional integrations
                and email notifications are in development.
              </p>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                {[
                  "Free plan available",
                  "Self-service signup",
                  "Upgrade when you need more",
                ].map((benefit) => (
                  <span
                    key={benefit}
                    className="inline-flex items-center gap-2">
                    <Check
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-primary"
                    />
                    {benefit}
                  </span>
                ))}
              </div>
            </div>

            <ProductPreview />
          </div>
        </section>

        <section className="border-y border-border bg-surface px-6 py-7">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row md:items-center">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              Built around customer work
            </p>

            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              For independent service providers and small teams ready to move
              beyond scattered notes, spreadsheets, and messages.
            </p>
          </div>
        </section>

        <section id="features" className="scroll-mt-8 px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-2xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                A place for the moving parts
              </p>

              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Your business has enough going on.
                <br />
                Keep the details together.
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon

                return (
                  <article
                    key={feature.label}
                    className="rounded-2xl border border-border bg-surface p-6 sm:p-7">
                    <div className="mb-6 flex items-center gap-3">
                      <div className="rounded-xl bg-primary/10 p-3 text-primary">
                        <Icon
                          aria-hidden="true"
                          className="h-5 w-5"
                          strokeWidth={1.7}
                        />
                      </div>

                      <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-muted">
                        {feature.label}
                      </p>
                    </div>

                    <h3 className="text-xl font-semibold tracking-tight">
                      {feature.title}
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {feature.description}
                    </p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-8 border-y border-border bg-surface-secondary px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                From first conversation to finished work
              </p>

              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                A clearer path through your day.
              </h2>
            </div>

            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {workflow.map((item) => (
                <article
                  key={item.step}
                  className="border-t border-border pt-6">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {item.step}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-8 px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-2xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                Room to grow
              </p>

              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Start free. Find your rhythm.
              </h2>

              <p className="mt-4 leading-relaxed text-muted">
                Get familiar with your workspace before choosing more capacity.
                Paid plans are available from workspace billing.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`flex flex-col rounded-2xl border bg-surface p-7 ${
                    plan.highlight
                      ? "border-primary shadow-lg"
                      : "border-border"
                  }`}>
                  <h3 className="font-mono text-lg font-semibold">
                    {plan.name}
                  </h3>

                  <p className="mt-3 text-sm font-medium text-primary">
                    {plan.audience}
                  </p>

                  <div className="mt-7">
                    <span className="text-5xl font-bold tracking-tight">
                      {plan.price}
                    </span>
                    <span className="ml-2 text-sm text-muted">/ month</span>
                  </div>

                  <p className="mt-5 flex-1 text-sm leading-relaxed text-muted">
                    {plan.description}
                  </p>

                  <Link
                    href="/signup"
                    className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border hover:bg-surface-secondary"
                    }`}>
                    Start free
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>

            <p className="mt-6 text-sm text-muted">
              Plans have different usage limits. Review current capacity and
              upgrade options in your workspace’s billing page.
            </p>
          </div>
        </section>

        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                Before your first cup
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">
                A few quick answers.
              </h2>
            </div>

            <div className="divide-y divide-border">
              {questions.map((item) => (
                <details key={item.question} className="group py-5 first:pt-0">
                  <summary className="cursor-pointer text-base font-semibold">
                    {item.question}
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-sidebar px-6 py-20 text-sidebar-foreground sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Coffee
              aria-hidden="true"
              className="mx-auto mb-6 h-8 w-8 text-sidebar-foreground"
              strokeWidth={1.5}
            />

            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Give your business
              <br />a little breathing room.
            </h2>

            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-sidebar-muted">
              Bring your customer details, upcoming work, and team into one
              workspace. Your next step can be a simpler one.
            </p>

            <Link
              href="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-sm font-semibold text-[#12372a] hover:bg-[#edf2ed]">
              Create your free workspace
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-muted md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} CoffeeShopCRM</span>

          <nav aria-label="Legal" className="flex items-center gap-5">
            <Link
              href="/terms"
              className="hover:text-foreground hover:underline">
              Terms
            </Link>

            <Link
              href="/privacy"
              className="hover:text-foreground hover:underline">
              Privacy
            </Link>

            <a
              href="mailto:ahenry@thirdgenerationstudios.com"
              className="hover:text-foreground hover:underline">
              Contact
            </a>
          </nav>
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
