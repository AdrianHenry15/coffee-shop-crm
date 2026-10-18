"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type FirstRunTourProps = {
  slug: string
  startOpen: boolean
}

const steps = [
  {
    title: "Welcome to CoffeeShop",
    description:
      "This workspace keeps your customer pipeline and daily work in one place. Take this quick tour to see where everything lives.",
  },
  {
    title: "Capture leads",
    description:
      "Add potential customers in Leads. Track their status as you contact and qualify them, then convert them to customers when they’re ready.",
    href: "leads",
    linkLabel: "Open Leads",
  },
  {
    title: "Manage customers",
    description:
      "Customers is your directory for active and inactive customers. Open a customer record to keep notes and activity together.",
    href: "customers",
    linkLabel: "Open Customers",
  },
  {
    title: "Create estimates",
    description:
      "Use Estimates to prepare and track work you’ve quoted. Accepted estimates can move into your job workflow.",
    href: "estimates",
    linkLabel: "Open Estimates",
  },
  {
    title: "Schedule and track jobs",
    description:
      "Jobs track the work you’ve committed to. Schedule shows what’s coming up so you can plan the week.",
    href: "jobs",
    linkLabel: "Open Jobs",
  },
  {
    title: "You’re ready to go",
    description:
      "Visit Settings to update your workspace details. You can reopen this tour any time using the button in the lower corner.",
    href: "settings",
    linkLabel: "Open Settings",
  },
]

export function FirstRunTour({ slug, startOpen }: FirstRunTourProps) {
  const router = useRouter()
  const [open, setOpen] = useState(startOpen)
  const [stepIndex, setStepIndex] = useState(0)

  const step = steps[stepIndex]

  function closeTour() {
    setOpen(false)
    router.replace(`/org/${slug}/dashboard`, { scroll: false })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStepIndex(0)
          setOpen(true)
        }}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:opacity-90">
        Take the tour
      </button>

      {open && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTour()
          }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-run-tour-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-primary">
                  CoffeeShopCRM tour · {stepIndex + 1} of {steps.length}
                </p>

                <h2
                  id="first-run-tour-title"
                  className="mt-3 font-mono text-2xl font-semibold">
                  {step.title}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Close tour"
                onClick={closeTour}
                className="rounded-md px-2 py-1 text-muted hover:bg-surface-secondary hover:text-foreground">
                Close
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">
              {step.description}
            </p>

            {"href" in step && step.href && "linkLabel" in step && (
              <Link
                href={`/org/${slug}/${step.href}`}
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                {step.linkLabel} →
              </Link>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <button
                type="button"
                onClick={closeTour}
                className="text-sm text-muted hover:text-foreground">
                Skip tour
              </button>

              <div className="flex gap-2">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setStepIndex((current) => current - 1)}
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-secondary">
                    Back
                  </button>
                )}

                {stepIndex < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((current) => current + 1)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeTour}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                    Finish
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
