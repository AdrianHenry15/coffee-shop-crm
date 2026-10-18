import "server-only"

export function getAuthConfig() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (!configuredSiteUrl && process.env.NODE_ENV === "production") {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL")
  }

  const siteUrl = new URL(
    configuredSiteUrl ?? "http://localhost:3000",
  )

  if (
    !["http:", "https:"].includes(siteUrl.protocol) ||
    (process.env.NODE_ENV === "production" &&
      siteUrl.protocol !== "https:")
  ) {
    throw new Error("Invalid NEXT_PUBLIC_SITE_URL")
  }

  return {
    siteUrl: siteUrl.origin,
  }
}