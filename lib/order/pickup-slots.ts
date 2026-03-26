// ── Pickup time slots ─────────────────────────────────────────────────────────
// Fixed 30-minute slots from 08:00 to 17:00.
// Extend this list or replace with a DB-driven model in future phases.

export const PICKUP_TIME_SLOTS: string[] = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00",
];

// Days of week that are open (0=Sun, 1=Mon … 6=Sat). Currently Mon–Sat.
export const BUSINESS_DAYS: number[] = [1, 2, 3, 4, 5, 6];

/**
 * Returns true when `date` is a valid pickup date:
 * – must be a business day
 * – must be today or in the future (UTC date comparison)
 */
export function isValidPickupDate(date: Date): boolean {
  const now = new Date();
  // Strip time to compare dates only
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const check = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (check < today) return false;
  return BUSINESS_DAYS.includes(check.getUTCDay());
}

/**
 * Returns the minimum allowed pickup date as a YYYY-MM-DD string.
 * Currently tomorrow (orders must be placed at least 1 day in advance).
 */
export function getMinPickupDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  // Advance past non-business days
  while (!BUSINESS_DAYS.includes(d.getUTCDay())) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}
