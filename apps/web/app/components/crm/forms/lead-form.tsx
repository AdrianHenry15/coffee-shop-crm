"use client"

import { useActionState, useEffect, useRef } from "react"
import {
  createLead,
  type CreateLeadState,
} from "@/app/org/[slug]/leads/actions"
import { SubmitButton } from "../ui/submit-button"

type Props = {
  slug: string
}

const initialState: CreateLeadState = {
  success: false,
  message: "",
}

export function LeadForm({ slug }: Props) {
  const [state, formAction] = useActionState(createLead, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-4 sm:grid-cols-2">
        <input
          name="name"
          required
          maxLength={200}
          placeholder="Name"
          className="rounded-md border p-3"
        />

        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-md border p-3"
        />

        <input
          name="phone"
          placeholder="Phone"
          className="rounded-md border p-3"
        />

        <input
          name="notes"
          placeholder="Notes"
          className="rounded-md border p-3"
        />
      </div>

      {state.message && (
        <p
          role="status"
          className={
            state.success ? "text-sm text-green-600" : "text-sm text-red-600"
          }>
          {state.message}
        </p>
      )}

      <SubmitButton
        pendingLabel="Creating lead..."
        className="rounded-md bg-black px-5 py-3 text-white">
        Create lead
      </SubmitButton>
    </form>
  )
}
