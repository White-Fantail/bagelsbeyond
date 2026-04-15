/**
 * Pure pricing health analysis helpers.
 * No server-only import — safe to use in tests.
 */

import type { PricingStatus, EffectivePricingTarget } from "@/lib/costing/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductHealthRow = {
  productId: string;
  productName: string;
  sellingPrice: number | null;
  adjustedCostPerUnit: number | null;
  actualCostPercent: number | null;
  actualMarginPercent: number | null;
  targetMarginPercent: number | null;
  targetCostPercent: number | null;
  effectiveTarget: EffectivePricingTarget | null;
  recommendedPrice: number | null;
  priceGap: number | null;
  pricingStatus: PricingStatus;
  /** Recommended price gap as a percentage of recommended price */
  priceGapPct: number | null;
};

// ─── Classification helpers ───────────────────────────────────────────────────

/**
 * Extracts target margin/cost percent from an effective pricing target.
 */
export function extractTargetPercents(target: EffectivePricingTarget | null): {
  targetMarginPercent: number | null;
  targetCostPercent: number | null;
} {
  if (!target) return { targetMarginPercent: null, targetCostPercent: null };
  if (target.targetType === "MARGIN_PERCENT") {
    return { targetMarginPercent: target.targetPercent, targetCostPercent: null };
  }
  return { targetMarginPercent: null, targetCostPercent: target.targetPercent };
}

/**
 * Returns a normalized price gap percentage.
 * priceGapPct = (sellingPrice - recommendedPrice) / recommendedPrice * 100
 */
export function computePriceGapPct(
  priceGap: number | null,
  recommendedPrice: number | null
): number | null {
  if (priceGap === null || recommendedPrice === null || recommendedPrice === 0) return null;
  return (priceGap / recommendedPrice) * 100;
}

// ─── Filtering / sorting ──────────────────────────────────────────────────────

/** Filters to only products below their target margin/cost */
export function filterBelowTarget(rows: ProductHealthRow[]): ProductHealthRow[] {
  return rows.filter((r) => r.pricingStatus === "BELOW_TARGET");
}

/** Filters products that are at or below target — "at risk" includes on-target products barely meeting threshold */
export function filterAtRisk(rows: ProductHealthRow[]): ProductHealthRow[] {
  return rows.filter((r) => r.pricingStatus === "BELOW_TARGET" || r.pricingStatus === "ON_TARGET");
}

/** Sort products by largest recommended price gap (below target first, largest gap first) */
export function sortByLargestPriceGap(rows: ProductHealthRow[]): ProductHealthRow[] {
  return [...rows]
    .filter((r) => r.priceGap !== null)
    .sort((a, b) => {
      // Negative price gap = below target; sort most negative first
      return (a.priceGap ?? 0) - (b.priceGap ?? 0);
    });
}

/** Sort products by highest adjusted cost per unit */
export function sortByHighestAdjustedCost(rows: ProductHealthRow[]): ProductHealthRow[] {
  return [...rows]
    .filter((r) => r.adjustedCostPerUnit !== null)
    .sort((a, b) => (b.adjustedCostPerUnit ?? 0) - (a.adjustedCostPerUnit ?? 0));
}

/** Sort by largest price gap percent descending (most negative first = below target worst) */
export function sortByLargestPriceGapPct(rows: ProductHealthRow[]): ProductHealthRow[] {
  return [...rows]
    .filter((r) => r.priceGapPct !== null)
    .sort((a, b) => (a.priceGapPct ?? 0) - (b.priceGapPct ?? 0));
}

// ─── Dashboard summary ────────────────────────────────────────────────────────

export type PricingHealthSummary = {
  totalProducts: number;
  belowTargetCount: number;
  aboveTargetCount: number;
  onTargetCount: number;
  noSellingPriceCount: number;
  noRecipeCostCount: number;
  noTargetCount: number;
  belowTargetProducts: ProductHealthRow[];
  largestPriceGapProducts: ProductHealthRow[];
  highestAdjustedCostProducts: ProductHealthRow[];
};

export function buildPricingHealthSummary(rows: ProductHealthRow[]): PricingHealthSummary {
  const belowTargetProducts = filterBelowTarget(rows);
  const largestPriceGapProducts = sortByLargestPriceGap(rows).slice(0, 10);
  const highestAdjustedCostProducts = sortByHighestAdjustedCost(rows).slice(0, 10);

  return {
    totalProducts: rows.length,
    belowTargetCount: rows.filter((r) => r.pricingStatus === "BELOW_TARGET").length,
    aboveTargetCount: rows.filter((r) => r.pricingStatus === "ABOVE_TARGET").length,
    onTargetCount: rows.filter((r) => r.pricingStatus === "ON_TARGET").length,
    noSellingPriceCount: rows.filter((r) => r.pricingStatus === "NO_SELLING_PRICE").length,
    noRecipeCostCount: rows.filter((r) => r.pricingStatus === "NO_RECIPE_COST").length,
    noTargetCount: rows.filter((r) => r.pricingStatus === "NO_TARGET").length,
    belowTargetProducts,
    largestPriceGapProducts,
    highestAdjustedCostProducts,
  };
}
