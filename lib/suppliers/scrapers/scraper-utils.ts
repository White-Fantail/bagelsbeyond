import { UnitType } from "@/app/generated/prisma/enums";

// ─── Shared scraper utilities ─────────────────────────────────────────────────

/**
 * Parse a price string like "$12.50", "NZ$12.50", or "12.50" into a number.
 * Returns NaN if the string cannot be parsed or contains multiple decimal
 * points (i.e. is malformed).
 */
export function parsePrice(raw: string): number {
  // Strip all non-numeric characters except the decimal point
  const cleaned = raw.replace(/[^0-9.]/g, "");

  // Reject malformed strings that contain more than one decimal point
  if ((cleaned.match(/\./g) ?? []).length > 1) return NaN;

  return parseFloat(cleaned);
}

/**
 * Infer a UnitType from a unit string found on the page.
 * Defaults to UnitType.EACH when unrecognised.
 */
export function inferUnit(raw: string): UnitType {
  const u = raw.toLowerCase().trim();
  if (u === "kg" || u === "kilogram" || u === "kilograms") return UnitType.KG;
  if (u === "g" || u === "gram" || u === "grams") return UnitType.G;
  if (
    u === "l" ||
    u === "litre" ||
    u === "litres" ||
    u === "liter" ||
    u === "liters"
  )
    return UnitType.L;
  if (u === "ml" || u === "millilitre" || u === "millilitres") return UnitType.ML;
  return UnitType.EACH;
}
