"use client"

import {
  convertLead,
  permanentlyDeleteLeads,
  restoreLeads,
  trashLeads,
  updateLead,
} from "@/app/org/[slug]/leads/actions"
import { ContactManager, type ManagedContact } from "./contact-manager"

type Lead = ManagedContact & {
  customers: { id: string }[]
}

type Props = {
  slug: string
  leads: Lead[]
  canManageDeletion?: boolean
}

export function LeadManager({ slug, leads, canManageDeletion = false }: Props) {
  return (
    <ContactManager
      key={`${slug}:${canManageDeletion}`}
      canManageDeletion={canManageDeletion}
      slug={slug}
      entity="leads"
      contacts={leads}
      onUpdate={updateLead}
      onConvert={convertLead}
      onTrash={trashLeads}
      onRestore={restoreLeads}
      onPermanentDelete={permanentlyDeleteLeads}
    />
  )
}
