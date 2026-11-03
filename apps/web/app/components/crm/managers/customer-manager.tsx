"use client"

import {
  permanentlyDeleteCustomers,
  restoreCustomers,
  trashCustomers,
  updateCustomer,
} from "@/app/org/[slug]/customers/actions"
import { ContactManager, type ManagedContact } from "./contact-manager"

type Customer = ManagedContact & {
  lead_id: string | null
}

type Props = {
  slug: string
  customers: Customer[]
  canManageDeletion?: boolean
}

export function CustomerManager({
  slug,
  customers,
  canManageDeletion = false,
}: Props) {
  return (
    <ContactManager
      key={`${slug}:${canManageDeletion}`}
      canManageDeletion={canManageDeletion}
      slug={slug}
      entity="customers"
      contacts={customers}
      onUpdate={updateCustomer}
      onTrash={trashCustomers}
      onRestore={restoreCustomers}
      onPermanentDelete={permanentlyDeleteCustomers}
    />
  )
}
