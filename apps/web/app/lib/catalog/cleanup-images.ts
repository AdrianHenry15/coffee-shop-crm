import "server-only"

import type { createAdminClient } from "@/app/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

export async function cleanupCatalogImages(admin: AdminClient) {
  const { data: jobs, error: claimError } = await admin.rpc(
    "claim_catalog_image_cleanup",
    { p_limit: 100 },
  )

  if (claimError) {
    throw new Error("Unable to claim catalog image cleanup jobs.", {
      cause: claimError,
    })
  }

  if (!jobs?.length) {
    return { completed: 0 }
  }

  const leaseToken = jobs[0].lease_token

  if (
    typeof leaseToken !== "string" ||
    !leaseToken ||
    jobs.some(
      (job) =>
        typeof job.object_path !== "string" ||
        !job.object_path ||
        job.lease_token !== leaseToken,
    )
  ) {
    throw new Error("Invalid catalog image cleanup batch.")
  }

  const paths = [...new Set(jobs.map((job) => job.object_path))]

  // Delete files through Storage before completing their cleanup jobs.
  const { error: storageError } = await admin.storage
    .from("catalog-images")
    .remove(paths)

  if (storageError) {
    throw new Error("Unable to remove unused catalog image files.", {
      cause: storageError,
    })
  }

  // PostgreSQL independently checks that the files and image records
  // are absent before marking these jobs complete.
  const { data: completed, error: completionError } = await admin.rpc(
    "complete_catalog_image_cleanup",
    {
      p_paths: paths,
      p_lease_token: leaseToken,
    },
  )

  if (completionError) {
    throw new Error("Unable to complete catalog image cleanup jobs.", {
      cause: completionError,
    })
  }

  if (completed !== paths.length) {
    throw new Error("Some catalog image cleanup jobs remain incomplete.")
  }

  return { completed }
}
