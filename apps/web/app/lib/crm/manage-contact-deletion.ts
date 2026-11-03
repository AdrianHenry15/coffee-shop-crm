import "server-only"

import { getWorkspaceAccess } from "@/app/lib/workspace-access"
import { changeContactDeletion } from "./contact-deletion"

export async function changeManagedContactDeletion(
  ...args: Parameters<typeof changeContactDeletion>
): Promise<number> {
  const [slug] = args
  const { canManageBusiness } = await getWorkspaceAccess(slug)

  if (!canManageBusiness) {
    throw new Error(
      "Only workspace owners and admins can archive, restore, or permanently delete contacts.",
    )
  }

  return changeContactDeletion(...args)
}
