"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/app/lib/supabase/server"

export async function createJob(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const customerId = String(formData.get("customerId") ?? "")
  const estimateId = String(formData.get("estimateId") ?? "")
  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const start = String(formData.get("scheduledStart") ?? "")
  const end = String(formData.get("scheduledEnd") ?? "")
  const creationRequestId = String(formData.get("creationRequestId") ?? "")

  if (!title || title.length > 200) {
    throw new Error("Job title must be 1–200 characters.")
  }

  if (!customerId) {
    throw new Error("A customer is required.")
  }

  const parseDate = (value: string) => {
    if (!value) return null

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid scheduled date.")
    }

    return date.toISOString()
  }

  const scheduledStart = parseDate(start)
  const scheduledEnd = parseDate(end)

  if (
    scheduledStart &&
    scheduledEnd &&
    Date.parse(scheduledEnd) <= Date.parse(scheduledStart)
  ) {
    throw new Error("End time must be after start time.")
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      creationRequestId,
    )
  ) {
    throw new Error("Invalid job creation request.")
  }

  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    redirect("/login")
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single()

  if (orgError || !organization) {
    throw new Error("Organization not found.")
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("organization_id", organization.id)
    .single()

  if (customerError || !customer) {
    throw new Error("Customer not found.")
  }

  if (estimateId) {
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, customer_id, status")
      .eq("id", estimateId)
      .eq("organization_id", organization.id)
      .single()

    if (
      estimateError ||
      !estimate ||
      estimate.customer_id !== customerId ||
      estimate.status !== "accepted"
    ) {
      throw new Error("Invalid or unaccepted estimate.")
    }
  }

  const { error } = await supabase.from("jobs").insert({
    organization_id: organization.id,
    customer_id: customer.id,
    estimate_id: estimateId || null,
    creation_request_id: creationRequestId,
    title,
    description: description || null,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    status: "scheduled",
  })

  if (error) {
    if (error.code === "23505") {
      const { data: existingJob, error: lookupError } = await supabase
        .from("jobs")
        .select(
          "id, customer_id, estimate_id, title, description, scheduled_start, scheduled_end",
        )
        .eq("organization_id", organization.id)
        .eq("creation_request_id", creationRequestId)
        .maybeSingle()

      if (lookupError) {
        throw new Error(lookupError.message)
      }

      if (existingJob) {
        const sameRequest =
          existingJob.customer_id === customerId &&
          existingJob.estimate_id === (estimateId || null) &&
          existingJob.title === title &&
          existingJob.description === (description || null) &&
          existingJob.scheduled_start === scheduledStart &&
          existingJob.scheduled_end === scheduledEnd

        if (!sameRequest) {
          throw new Error(
            "This request ID was already used for a different job.",
          )
        }

        revalidatePath(`/org/${slug}/jobs`)
        return { success: true }
      }
    }

    throw new Error(error.message)
  }

  revalidatePath(`/org/${slug}/jobs`)
  return { success: true }
}

type JobStatus = "scheduled" | "in_progress" | "completed" | "canceled"

async function getJob(slug: string, jobId: string) {
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    throw new Error("Unauthorized.")
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single()

  if (orgError || !organization) {
    throw new Error("Organization not found.")
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .eq("organization_id", organization.id)
    .single()

  if (jobError || !job) {
    throw new Error("Job not found.")
  }

  return { supabase, organization, job }
}

export async function updateJobStatus(
  slug: string,
  jobId: string,
  status: JobStatus,
) {
  const validStatuses: JobStatus[] = [
    "scheduled",
    "in_progress",
    "completed",
    "canceled",
  ]

  if (!validStatuses.includes(status)) {
    throw new Error("Invalid job status.")
  }

  const { supabase, organization } = await getJob(slug, jobId)

  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId)
    .eq("organization_id", organization.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/org/${slug}/jobs`)
  revalidatePath(`/org/${slug}/jobs/${jobId}`)
}

export async function updateJob(
  slug: string,
  jobId: string,
  data: {
    title: string
    description: string
    scheduledStart: string
    scheduledEnd: string
  },
) {
  const title = data.title.trim()
  const description = data.description.trim()

  if (!title || title.length > 200) {
    throw new Error("Job title must be 1–200 characters.")
  }

  function parseDate(value: string) {
    if (!value) return null

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid scheduled date.")
    }

    return date.toISOString()
  }

  const scheduledStart = parseDate(data.scheduledStart)
  const scheduledEnd = parseDate(data.scheduledEnd)

  if (
    scheduledStart &&
    scheduledEnd &&
    new Date(scheduledEnd) <= new Date(scheduledStart)
  ) {
    throw new Error("End time must be after start time.")
  }

  const { supabase, organization } = await getJob(slug, jobId)

  const { error } = await supabase
    .from("jobs")
    .update({
      title,
      description: description || null,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
    })
    .eq("id", jobId)
    .eq("organization_id", organization.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/org/${slug}/jobs`)
  revalidatePath(`/org/${slug}/jobs/${jobId}`)
}

export async function deleteJob(slug: string, jobId: string) {
  const { supabase, organization } = await getJob(slug, jobId)

  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("organization_id", organization.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/org/${slug}/jobs`)

  redirect(`/org/${slug}/jobs?success=deleted`)
}
