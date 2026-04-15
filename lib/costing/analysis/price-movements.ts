/**
 * Pure price movement analysis helpers.
 * No server-only import — safe to use in tests.
 */

import { UnitType, PriceHistorySourceType } from "@/app/generated/prisma/enums";
import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal representation of a price history row for movement analysis */
export type HistoryEntryInput = {
  id: string;
  ingredientId: string;
  purchasePrice: number;
  purchaseQuantity: number;
  purchaseUnit: UnitType;
  baseUnit: UnitType;
  yieldPercent: number;
  sourceType: PriceHistorySourceType;
  effectiveFrom: string;
  createdAt: string;
};

export type IngredientMovementRow = {
  ingredientId: string;
  ingredientName: string;
  currentPurchasePrice: number;
  previousPurchasePrice: number | null;
  currentStandardUnitCost: number | null;
  previousStandardUnitCost: number | null;
  /** Absolute delta in purchase price (current - previous) */
  priceDelta: number | null;
  /** Percent delta in purchase price */
  priceDeltaPct: number | null;
  /** Absolute delta in standard unit cost */
  standardCostDelta: number | null;
  /** Percent delta in standard unit cost */
  standardCostDeltaPct: number | null;
  lastUpdatedAt: string;
  sourceType: PriceHistorySourceType;
  /** True when only one history entry exists (no previous to compare) */
  isFirstEntry: boolean;
};

export type StaleIngredientRow = {
  ingredientId: string;
  ingredientName: string;
  lastUpdatedAt: string | null;
  daysSinceUpdate: number | null;
};

// ─── Standard unit cost helper ────────────────────────────────────────────────

export function computeStandardUnitCost(entry: HistoryEntryInput): number | null {
  const result = calculateStandardUnitCost(
    entry.purchasePrice,
    entry.purchaseQuantity,
    entry.purchaseUnit,
    entry.baseUnit
  );
  return result.isConvertible ? result.standardUnitCost : null;
}

// ─── Delta computation ────────────────────────────────────────────────────────

/**
 * Computes movement delta between the current (latest) and previous history entry.
 * Returns null deltas when there is no previous entry.
 */
export function computeMovementDelta(
  ingredientId: string,
  ingredientName: string,
  current: HistoryEntryInput,
  previous: HistoryEntryInput | null
): IngredientMovementRow {
  const currentCost = computeStandardUnitCost(current);
  const previousCost = previous ? computeStandardUnitCost(previous) : null;

  const priceDelta = previous !== null ? current.purchasePrice - previous.purchasePrice : null;
  const priceDeltaPct =
    priceDelta !== null && previous !== null && previous.purchasePrice !== 0
      ? (priceDelta / previous.purchasePrice) * 100
      : null;

  const standardCostDelta =
    currentCost !== null && previousCost !== null ? currentCost - previousCost : null;
  const standardCostDeltaPct =
    standardCostDelta !== null && previousCost !== null && previousCost !== 0
      ? (standardCostDelta / previousCost) * 100
      : null;

  return {
    ingredientId,
    ingredientName,
    currentPurchasePrice: current.purchasePrice,
    previousPurchasePrice: previous?.purchasePrice ?? null,
    currentStandardUnitCost: currentCost,
    previousStandardUnitCost: previousCost,
    priceDelta,
    priceDeltaPct,
    standardCostDelta,
    standardCostDeltaPct,
    lastUpdatedAt: current.effectiveFrom,
    sourceType: current.sourceType,
    isFirstEntry: previous === null,
  };
}

// ─── Staleness detection ──────────────────────────────────────────────────────

/** Number of days without an update before an ingredient is considered stale */
export const STALE_INGREDIENT_DAYS = 30;

export function isIngredientStale(lastUpdatedAt: string | null, staleDays = STALE_INGREDIENT_DAYS): boolean {
  if (!lastUpdatedAt) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);
  return new Date(lastUpdatedAt) < cutoff;
}

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ─── Filtering / sorting ──────────────────────────────────────────────────────

/**
 * Returns movements sorted by biggest price increase (largest positive priceDeltaPct first).
 * Entries with no delta (first entry) are excluded.
 */
export function sortByBiggestIncrease(rows: IngredientMovementRow[]): IngredientMovementRow[] {
  return rows
    .filter((r) => r.priceDeltaPct !== null && r.priceDeltaPct > 0)
    .sort((a, b) => (b.priceDeltaPct ?? 0) - (a.priceDeltaPct ?? 0));
}

/**
 * Returns movements sorted by biggest price decrease (largest negative priceDeltaPct first).
 */
export function sortByBiggestDecrease(rows: IngredientMovementRow[]): IngredientMovementRow[] {
  return rows
    .filter((r) => r.priceDeltaPct !== null && r.priceDeltaPct < 0)
    .sort((a, b) => (a.priceDeltaPct ?? 0) - (b.priceDeltaPct ?? 0));
}

/**
 * Returns movements where the last update is within the given number of days.
 */
export function filterRecentlyUpdated(
  rows: IngredientMovementRow[],
  days: number
): IngredientMovementRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return rows.filter((r) => new Date(r.lastUpdatedAt) >= cutoff);
}

/**
 * Builds stale ingredient entries from the set of ingredients with their last update date.
 */
export function buildStaleIngredients(
  ingredients: Array<{ ingredientId: string; ingredientName: string; lastUpdatedAt: string | null }>,
  staleDays = STALE_INGREDIENT_DAYS
): StaleIngredientRow[] {
  return ingredients
    .filter((i) => isIngredientStale(i.lastUpdatedAt, staleDays))
    .map((i) => ({
      ingredientId: i.ingredientId,
      ingredientName: i.ingredientName,
      lastUpdatedAt: i.lastUpdatedAt,
      daysSinceUpdate: daysSince(i.lastUpdatedAt),
    }))
    .sort((a, b) => {
      if (a.daysSinceUpdate === null) return -1;
      if (b.daysSinceUpdate === null) return 1;
      return b.daysSinceUpdate - a.daysSinceUpdate;
    });
}
