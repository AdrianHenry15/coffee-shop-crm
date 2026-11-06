import "server-only"

import { getAuthConfig } from "@/app/lib/auth/config"

type WorkspaceInvitationEmail = {
  invitationId: string
  workspaceName: string
  email: string
  role: "admin" | "member"
}

export async function sendWorkspaceInvitationEmail({
  invitationId,
  workspaceName,
  email,
  role,
}: WorkspaceInvitationEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    console.error("Workspace invitation email configuration is missing.")
    return false
  }

  try {
    const { siteUrl } = getAuthConfig()
    const dashboardUrl = new URL("/dashboard", siteUrl).toString()
    const signupUrl = new URL("/signup", siteUrl).toString()

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `workspace-invitation/${invitationId}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        reply_to: "ahenry@thirdgenerationstudios.com",
        subject: "You’re invited to a CoffeeShopCRM workspace",
        text: [
          `You’ve been invited to join ${workspaceName} on CoffeeShopCRM.`,
          "",
          `Your invited role: ${role === "admin" ? "Admin" : "Member"}.`,
          "",
          `Sign in using ${email}, then review and accept your invitation:`,
          dashboardUrl,
          "",
          "Don’t have an account? Create one using the invited email:",
          signupUrl,
          "",
          "Confirm your account email before accepting the invitation.",
          "Invitations expire after 7 days. Workspace member capacity is checked when you accept.",
          "",
          "If you weren’t expecting this invitation, you can ignore this email.",
          "",
          "CoffeeShopCRM",
          "Operated by Third Generation Studios",
          "Questions? ahenry@thirdgenerationstudios.com",
        ].join("\n"),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      console.error("Resend rejected a workspace invitation email.", {
        status: response.status,
      })
      return false
    }

    const result: unknown = await response.json()

    return (
      typeof result === "object" &&
      result !== null &&
      "id" in result &&
      typeof result.id === "string" &&
      result.id.length > 0
    )
  } catch {
    console.error("Unable to confirm workspace invitation email submission.")
    return false
  }
}
