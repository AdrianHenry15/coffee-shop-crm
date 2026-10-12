"use client"

import { useActionState, useEffect, useRef } from "react"
import {
  createCustomer,
  type CreateCustomerState,
} from "@/app/org/[slug]/customers/actions"
import { SubmitButton } from "../ui/submit-button"
import { toast } from "sonner"

type Props = {
  slug: string
}

const initialState: CreateCustomerState = {
  success: false,
  message: "",
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"

export function CustomerForm({ slug }: Props) {
  const [state, formAction] = useActionState(createCustomer, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state.message) return

    if (state.success) {
      formRef.current?.reset()
      toast.success(state.message)
    } else {
      toast.error(state.message)
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="customer-name"
            className="block text-sm font-medium text-foreground">
            Name <span className="text-primary">*</span>
          </label>
          <input
            id="customer-name"
            name="name"
            required
            maxLength={200}
            placeholder="Full name"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="customer-email"
            className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="customer-email"
            name="email"
            type="email"
            placeholder="name@example.com"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="customer-phone"
            className="block text-sm font-medium text-foreground">
            Phone
          </label>
          <input
            id="customer-phone"
            name="phone"
            type="tel"
            placeholder="Phone number"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="customer-notes"
            className="block text-sm font-medium text-foreground">
            Notes
          </label>
          <input
            id="customer-notes"
            name="notes"
            placeholder="Additional details"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-5">
        <SubmitButton
          pendingLabel="Creating customer..."
          className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
          Create customer
        </SubmitButton>
      </div>
    </form>
  )
}
