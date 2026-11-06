import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { NextResponse } from "next/server"
import { getAuthConfig } from "@/app/lib/auth/config"
import { createAdminClient } from "@/app/lib/supabase/admin"
import { verifyLeadCaptcha } from "@/app/lib/leads/verify-captcha"

export const runtime = "nodejs"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function reply(status: number, message: string) {
  return NextResponse.json(
    { success: status === 200, message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        ...(status === 429 ? { "Retry-After": "600" } : {}),
      },
    },
  )
}

async function readBody(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  ) {
    throw new Error("Invalid content type.")
  }

  const reader = request.body?.getReader()

  if (!reader) {
    throw new Error("Missing request body.")
  }

  const chunks: Uint8Array[] = []
  let size = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      size += value.byteLength

      if (size > 32_768) {
        await reader.cancel()
        throw new Error("Request is too large.")
      }

      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function getVisitorAddress(request: Request): string {
  // Trust this forwarding header only on the Vercel deployment.
  if (process.env.VERCEL === "1") {
    const address = request.headers.get("x-forwarded-for")?.split(",")[0].trim()

    if (!address || !isIP(address)) {
      throw new Error("Unable to identify visitor.")
    }

    return address
  }

  if (process.env.NODE_ENV === "development") {
    return "127.0.0.1"
  }

  throw new Error("Visitor identification requires hosting configuration.")
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  const { formId } = await params

  if (!uuidPattern.test(formId)) {
    return reply(404, "This contact form is unavailable.")
  }

  let body: unknown

  try {
    body = await readBody(request)
  } catch {
    return reply(400, "Unable to read this submission.")
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reply(400, "Invalid submission.")
  }

  const fields = body as Record<string, unknown>
  const { submissionId, name, email, phone, message, captchaToken, website } =
    fields

  if (
    typeof submissionId !== "string" ||
    !uuidPattern.test(submissionId) ||
    typeof name !== "string" ||
    name.trim().length < 1 ||
    name.length > 200 ||
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof phone !== "string" ||
    phone.length > 50 ||
    typeof message !== "string" ||
    message.trim().length < 1 ||
    message.length > 5000 ||
    typeof captchaToken !== "string" ||
    !captchaToken.trim() ||
    captchaToken.length > 2048 ||
    // Hidden honeypot field, not the customer's actual website.
    (website !== undefined && website !== "")
  ) {
    return reply(400, "Check your contact details and verification.")
  }

  try {
    const { siteUrl } = getAuthConfig()

    // This first version accepts submissions from our hosted form.
    if (request.headers.get("origin") !== siteUrl) {
      return reply(403, "Submit your message through the contact form.")
    }

    const rateSecret = process.env.LEAD_RATE_LIMIT_SECRET

    if (!rateSecret || rateSecret.length < 32) {
      throw new Error("Missing public lead rate configuration.")
    }

    const visitorHash = createHmac("sha256", rateSecret)
      .update(`${formId.toLowerCase()}:${getVisitorAddress(request)}`)
      .digest("hex")

    const admin = createAdminClient()

    // Counts attempts before contacting the CAPTCHA provider.
    const { data: allowed, error: rateError } = await admin.rpc(
      "consume_public_lead_attempt",
      {
        p_form_id: formId,
        p_visitor_hash: visitorHash,
      },
    )

    if (rateError) {
      throw new Error("Unable to verify submission limits.")
    }

    if (allowed !== true) {
      return reply(
        429,
        "This form is unavailable or has received too many attempts. Try again later.",
      )
    }

    if (!(await verifyLeadCaptcha(captchaToken))) {
      return reply(400, "Verification expired or failed. Complete a new check.")
    }

    const { error } = await admin.rpc("submit_public_lead", {
      p_form_id: formId,
      p_submission_id: submissionId,
      p_name: name,
      p_email: email,
      p_phone: phone,
      p_message: message,
    })

    if (error) {
      if (error.code === "22023") {
        return reply(400, "Check your contact details and try again.")
      }

      if (error.code === "P0002") {
        return reply(404, "This contact form is unavailable.")
      }

      if (
        error.code === "P0001" &&
        error.message === "Contact form submission limit reached"
      ) {
        return reply(429, "This form is busy. Please try again later.")
      }

      // Keep subscription details and database errors private.
      console.error("Public lead submission was rejected.", {
        code: error.code,
      })

      return reply(
        503,
        "We couldn't save your message. Try again later or contact the business directly.",
      )
    }

    return reply(200, "Your message was received.")
  } catch {
    console.error("Public lead submission could not be processed.")

    return reply(503, "Submission is temporarily unavailable. Try again later.")
  }
}
