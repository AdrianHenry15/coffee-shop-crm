/**
 * Converts a browser-local datetime input to an ISO UTC timestamp.
 *
 * Example:
 * "2026-10-20T09:00" -> ISO timestamp representing
 * 9:00 AM in the user's local timezone.
 */
export function localToUTC(value: string): string {
  if (!value) return ""

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.")
  }

  return date.toISOString()
}

/**
 * Converts a stored UTC timestamp into the format required
 * by <input type="datetime-local" />.
 */
export function utcToLocal(value: string | null): string {
  if (!value) return ""

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

/**
 * Formats a timestamp using the browser's local timezone.
 */
export function formatLocalDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

import { fromZonedTime, toZonedTime } from "date-fns-tz"

/**
 * Convert an organization's local date/time into UTC.
 *
 * Example:
 * "2026-10-20T09:00" in America/New_York
 * becomes the corresponding UTC timestamp.
 */
export function organizationTimeToUTC(value: string, timezone: string): string {
  if (!value) return ""

  const date = fromZonedTime(value, timezone)

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.")
  }

  return date.toISOString()
}

/**
 * Convert a UTC timestamp into an organization's local
 * datetime-local input value.
 */
export function utcToOrganizationTime(
  value: string | null,
  timezone: string,
): string {
  if (!value) return ""

  const date = toZonedTime(value, timezone)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hour}:${minute}`
}

/**
 * Format a UTC timestamp for the organization's timezone.
 */
export function formatOrganizationDateTime(
  value: string,
  timezone: string,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
