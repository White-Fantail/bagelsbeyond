/**
 * Pure recipe / menu impact analysis helpers.
 * No server-only import — safe to use in tests.
 */

import { calculateEffectiveQuantity } from "@/lib/costing/recipe-cost";
import { calculateRecommendedPrice } from "@/lib/costing/pricing";
import type { EffectivePricingTarget } from "@/lib/costing/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecipeItemImpactInput = {
  /** Usage quantity in the recipe (before yield) */
  quantity: number;
  yieldPercent: number;
  /** Standard unit cost before the price change */
  previousStandardUnitCost: number | null;
  /** Standard unit cost after the price change */
  currentStandardUnitCost: number | null;
};

export type RecipeItemImpact = {
  previousLineCost: number | null;
  currentLineCost: number | null;
  costDelta: number | null;
};

export type ProductImpactRow = {
  productId: string;
  productName: string;
  sellingPrice: number | null;
  /** Total batch adjusted cost before price change */
  previousAdjustedCost: number | null;
  /** Total batch adjusted cost after price change */
  currentAdjustedCost: number | null;
  /** Cost delta in the batch (current - previous) */
  costDelta: number | null;
  /** Cost per output unit before price change */
  previousCostPerUnit: number | null;
  /** Cost per output unit after price change */
  currentCostPerUnit: number | null;
  /** Usage quantity of the changed ingredient */
  ingredientQuantity: number;
  /** Yield percent applied to the ingredient */
  yieldPercent: number;
  /** Previous cost contribution of the ingredient to this product */
  previousContribution: number | null;
  /** Current cost contribution of the ingredient to this product */
  currentContribution: number | null;
  /** Delta in contribution */
  contributionDelta: number | null;
  /** Output quantity for this batch recipe */
  outputQuantity: number;
  /** Margin effect — change in actual margin percent (requires sellingPrice) */
  marginEffect: number | null;
  /** Recommended price before change */
  previousRecommendedPrice: number | null;
  /** Recommended price after change */
  currentRecommendedPrice: number | null;
  /** Recommended price delta */
  recommendedPriceDelta: number | null;
};

// ─── Item-level impact ────────────────────────────────────────────────────────

/**
 * Calculates the impact of a standard unit cost change on a single recipe item.
 */
export function computeRecipeItemImpact(input: RecipeItemImpactInput): RecipeItemImpact {
  const effectiveQty = calculateEffectiveQuantity(input.quantity, input.yieldPercent);

  const previousLineCost =
    input.previousStandardUnitCost !== null
      ? effectiveQty * input.previousStandardUnitCost
      : null;
  const currentLineCost =
    input.currentStandardUnitCost !== null
      ? effectiveQty * input.currentStandardUnitCost
      : null;

  const costDelta =
    currentLineCost !== null && previousLineCost !== null
      ? currentLineCost - previousLineCost
      : null;

  return { previousLineCost, currentLineCost, costDelta };
}

// ─── Product-level impact ─────────────────────────────────────────────────────

/**
 * Computes the full product-level impact of a standard unit cost change.
 *
 * @param productId - The product identifier
 * @param productName - The product display name
 * @param sellingPrice - Current selling price (null if not set)
 * @param ingredientQuantity - Amount of the changed ingredient used in the recipe
 * @param yieldPercent - Yield percent for the ingredient in this recipe
 * @param previousStandardUnitCost - Standard unit cost before change
 * @param currentStandardUnitCost - Standard unit cost after change
 * @param previousBatchAdjustedCost - Total adjusted batch cost before change (all items)
 * @param currentBatchAdjustedCost - Total adjusted batch cost after change (all items)
 * @param outputQuantity - Batch output quantity
 * @param target - Effective pricing target for recommended price calculation
 */
export function computeProductImpact(
  productId: string,
  productName: string,
  sellingPrice: number | null,
  ingredientQuantity: number,
  yieldPercent: number,
  previousStandardUnitCost: number | null,
  currentStandardUnitCost: number | null,
  previousBatchAdjustedCost: number | null,
  currentBatchAdjustedCost: number | null,
  outputQuantity: number,
  target: EffectivePricingTarget | null
): ProductImpactRow {
  const itemImpact = computeRecipeItemImpact({
    quantity: ingredientQuantity,
    yieldPercent,
    previousStandardUnitCost,
    currentStandardUnitCost,
  });

  const costDelta =
    currentBatchAdjustedCost !== null && previousBatchAdjustedCost !== null
      ? currentBatchAdjustedCost - previousBatchAdjustedCost
      : null;

  const previousCostPerUnit =
    previousBatchAdjustedCost !== null && outputQuantity > 0
      ? previousBatchAdjustedCost / outputQuantity
      : null;
  const currentCostPerUnit =
    currentBatchAdjustedCost !== null && outputQuantity > 0
      ? currentBatchAdjustedCost / outputQuantity
      : null;

  // Margin effect: change in actual margin percent
  let marginEffect: number | null = null;
  if (sellingPrice !== null && sellingPrice > 0) {
    const previousMargin =
      previousCostPerUnit !== null
        ? ((sellingPrice - previousCostPerUnit) / sellingPrice) * 100
        : null;
    const currentMargin =
      currentCostPerUnit !== null
        ? ((sellingPrice - currentCostPerUnit) / sellingPrice) * 100
        : null;
    if (previousMargin !== null && currentMargin !== null) {
      marginEffect = currentMargin - previousMargin;
    }
  }

  // Recommended price delta
  const previousRecommendedPrice =
    previousCostPerUnit !== null ? calculateRecommendedPrice(previousCostPerUnit, target) : null;
  const currentRecommendedPrice =
    currentCostPerUnit !== null ? calculateRecommendedPrice(currentCostPerUnit, target) : null;
  const recommendedPriceDelta =
    currentRecommendedPrice !== null && previousRecommendedPrice !== null
      ? currentRecommendedPrice - previousRecommendedPrice
      : null;

  return {
    productId,
    productName,
    sellingPrice,
    previousAdjustedCost: previousBatchAdjustedCost,
    currentAdjustedCost: currentBatchAdjustedCost,
    costDelta,
    previousCostPerUnit,
    currentCostPerUnit,
    ingredientQuantity,
    yieldPercent,
    previousContribution: itemImpact.previousLineCost,
    currentContribution: itemImpact.currentLineCost,
    contributionDelta: itemImpact.costDelta,
    outputQuantity,
    marginEffect,
    previousRecommendedPrice,
    currentRecommendedPrice,
    recommendedPriceDelta,
  };
}

// ─── Sorting helpers ──────────────────────────────────────────────────────────

/** Sort product impacts by absolute cost delta descending (largest impact first) */
export function sortByAbsoluteCostDelta(rows: ProductImpactRow[]): ProductImpactRow[] {
  return [...rows].sort((a, b) => {
    const aAbs = a.costDelta !== null ? Math.abs(a.costDelta) : 0;
    const bAbs = b.costDelta !== null ? Math.abs(b.costDelta) : 0;
    return bAbs - aAbs;
  });
}
