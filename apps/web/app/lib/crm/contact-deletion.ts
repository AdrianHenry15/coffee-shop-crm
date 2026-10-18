import "server-only"

import { createClient } from "@/app/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

type ContactEntity = "leads" | "customers"
type ContactOperation = "trash" | "restore" | "delete"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function changeContactDeletion(
  slug: string,
  ids: string[],
  entity: ContactEntity,
  operation: ContactOperation,
): Promise<number> {
  if (typeof slug !== "string" || !slug.trim()) {
    throw new Error("Missing workspace.")
  }

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 500 ||
    ids.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))
  ) {
    throw new Error("Select between 1 and 500 valid contacts.")
  }

  const contactIds = [...new Set(ids)]
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData.user) {
    redirect("/login")
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single()

  if (organizationError || !organization) {
    throw new Error("Workspace not found or access denied.")
  }

  // Use the signed-in user's client so existing RLS permissions apply.
  const query =
    operation === "delete"
      ? supabase.from(entity).delete()
      : supabase.from(entity).update({
          deleted_at: operation === "trash" ? new Date().toISOString() : null,
        })

  const scopedQuery = query
    .eq("organization_id", organization.id)
    .in("id", contactIds)

  const { data, error } =
    operation === "trash"
      ? await scopedQuery.is("deleted_at", null).select("id")
      : await scopedQuery.not("deleted_at", "is", null).select("id")

  if (error) {
    console.error("Contact deletion operation failed:", {
      entity,
      operation,
      error,
    })

    if (
      operation === "delete" &&
      entity === "customers" &&
      error.code === "23503"
    ) {
      throw new Error(
        "One or more selected customers have linked records, such as estimates or jobs. None of the selected customers were permanently deleted.",
      )
    }

    throw new Error(
      operation === "trash"
        ? "Unable to move the selected contacts to Recently Deleted."
        : operation === "restore"
          ? "Unable to restore the selected contacts."
          : "Unable to permanently delete the selected contacts.",
    )
  }

  // Refresh contact lists, details, and related workspace pages.
  revalidatePath(`/org/${slug}`, "layout")

  // Return the actual affected count, including stale-selection cases.
  return data?.length ?? 0
}
