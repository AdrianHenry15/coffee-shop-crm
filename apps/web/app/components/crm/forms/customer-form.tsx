"use client"

import { useActionState, useEffect, useRef } from "react"
import {
  createCustomer,
  type CreateCustomerState,
} from "@/app/org/[slug]/customers/actions"
import { SubmitButton } from "../ui/submit-button"

type Props = {
  slug: string
}

const initialState: CreateCustomerState = {
  success: false,
  message: "",
}

export function CustomerForm({ slug }: Props) {
  const [state, formAction] = useActionState(createCustomer, initialState)

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
        pendingLabel="Creating customer..."
        className="rounded-md bg-black px-5 py-3 text-white">
        Create customer
      </SubmitButton>
    </form>
  )
}
