/**
 * Generates a human-readable order number.
 * Format: ORD-YYYYMMDD-XXXX  (XXXX = zero-padded random 4-digit number)
 * Example: ORD-20260326-0742
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000); // 1000–9999
  return `ORD-${yyyy}${mm}${dd}-${rand}`;
}
