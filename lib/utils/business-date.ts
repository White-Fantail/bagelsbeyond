/**
 * Business Date Utilities
 *
 * "Today" is always calculated based on the business operating timezone,
 * NOT the server's UTC clock. This ensures that day boundaries (midnight)
 * match what the business considers a new day.
 *
 * Configure via environment variable:
 *   APP_TIMEZONE=Pacific/Auckland   (business operating timezone)
 *   Falls back to DEFAULT_TIMEZONE, then "Pacific/Auckland" if neither is set.
 *
 * Policy:
 *   - All dates stored in DB are UTC midnight (db.Date / @db.Date).
 *   - getBusinessDate() returns a Date whose UTC components represent today
 *     in the business timezone.
 *   - toBusinessDateString() converts such a Date to a "YYYY-MM-DD" string.
 */

export function getBusinessTimezone(): string {
  return (
    process.env.APP_TIMEZONE ??
    process.env.DEFAULT_TIMEZONE ??
    "Pacific/Auckland"
  );
}

/**
 * Get today's date as a UTC-midnight Date, computed in the business timezone.
 *
 * Example:
 *   APP_TIMEZONE=Pacific/Auckland (UTC+13 in summer)
 *   Server UTC clock: 2024-01-14 14:00:00 UTC
 *   Business local:   2024-01-15 03:00:00 NZDT
 *   Returns: new Date("2024-01-15T00:00:00.000Z")
 *
 * @param timezone  Override timezone (defaults to APP_TIMEZONE env var)
 */
export function getBusinessDate(timezone?: string): Date {
  const tz = timezone ?? getBusinessTimezone();
  const now = new Date();

  // en-CA locale produces "YYYY-MM-DD" format
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const dateStr = formatter.format(now); // e.g. "2024-01-15"
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Convert a UTC-midnight Date (as stored in DB) to a "YYYY-MM-DD" string.
 * Since DB dates are stored as UTC midnight, slicing the ISO string is correct.
 *
 * @param date  A Date object representing a day (UTC midnight)
 */
export function toBusinessDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
