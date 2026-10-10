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
