"use client"

import { useActionState, useEffect, useRef } from "react"
import {
  createLead,
  type CreateLeadState,
} from "@/app/org/[slug]/leads/actions"
import { SubmitButton } from "../ui/submit-button"
import { toast } from "sonner"

type Props = {
  slug: string
}

const initialState: CreateLeadState = {
  success: false,
  message: "",
}

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"

export function LeadForm({ slug }: Props) {
  const [state, formAction] = useActionState(createLead, initialState)
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
            htmlFor="lead-name"
            className="block text-sm font-medium text-foreground">
            Name <span className="text-primary">*</span>
          </label>
          <input
            id="lead-name"
            name="name"
            required
            maxLength={200}
            placeholder="Full name"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="lead-email"
            className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="lead-email"
            name="email"
            type="email"
            placeholder="name@example.com"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="lead-phone"
            className="block text-sm font-medium text-foreground">
            Phone
          </label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            placeholder="Phone number"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="lead-notes"
            className="block text-sm font-medium text-foreground">
            Notes
          </label>
          <input
            id="lead-notes"
            name="notes"
            placeholder="Additional details"
            className={inputClassName}
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-5">
        <SubmitButton
          pendingLabel="Creating lead..."
          className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
          Create lead
        </SubmitButton>
      </div>
    </form>
  )
}
