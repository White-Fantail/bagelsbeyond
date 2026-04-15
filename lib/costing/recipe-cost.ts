/**
 * Pure (server-only-free) recipe cost calculation helpers.
 * These can be imported in both service layer and tests.
 */

/**
 * Calculates the line cost for a single recipe item.
 * lineCost = quantity × standardUnitCost
 * Returns null if standardUnitCost is unavailable.
 */
export function calculateRecipeItemCost(
  quantity: number,
  standardUnitCost: number | null
): number | null {
  if (standardUnitCost === null) return null;
  return quantity * standardUnitCost;
}

/**
 * Calculates the effective quantity after applying yield adjustment.
 * effectiveQuantity = quantity / (yieldPercent / 100)
 * When yieldPercent is 100, effectiveQuantity equals quantity.
 */
export function calculateEffectiveQuantity(
  quantity: number,
  yieldPercent: number
): number {
  if (yieldPercent === 100) return quantity;
  return quantity / (yieldPercent / 100);
}

/**
 * Calculates the yield-adjusted line cost for a single recipe item.
 * adjustedLineCost = effectiveQuantity × standardUnitCost
 * Returns null if standardUnitCost is unavailable.
 */
export function calculateAdjustedLineCost(
  quantity: number,
  yieldPercent: number,
  standardUnitCost: number | null
): number | null {
  if (standardUnitCost === null) return null;
  const effectiveQty = calculateEffectiveQuantity(quantity, yieldPercent);
  return effectiveQty * standardUnitCost;
}

/**
 * Calculates the total cost from an array of line costs.
 * Returns null if any line cost is null (incomplete costing).
 */
export function calculateRecipeTotalCost(lineCosts: (number | null)[]): number | null {
  if (lineCosts.some((c) => c === null)) return null;
  return (lineCosts as number[]).reduce((acc, c) => acc + c, 0);
}

/**
 * Calculates the cost per output unit for a batch recipe.
 * costPerUnit = batchTotalCost / outputQuantity
 * Returns null if either argument is null or outputQuantity is 0.
 */
export function calculateCostPerOutputUnit(
  batchTotalCost: number | null,
  outputQuantity: number
): number | null {
  if (batchTotalCost === null || outputQuantity <= 0) return null;
  return batchTotalCost / outputQuantity;
}

/**
 * Calculates the line cost for a product-component recipe item.
 * lineCost = quantity × componentUnitCost
 * Returns null if componentUnitCost is unavailable.
 */
export function calculateComponentProductLineCost(
  quantity: number,
  componentUnitCost: number | null
): number | null {
  if (componentUnitCost === null) return null;
  return quantity * componentUnitCost;
}
