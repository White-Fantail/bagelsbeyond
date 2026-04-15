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
 * Calculates the total cost from an array of line costs.
 * Returns null if any line cost is null (incomplete costing).
 */
export function calculateRecipeTotalCost(lineCosts: (number | null)[]): number | null {
  if (lineCosts.some((c) => c === null)) return null;
  return (lineCosts as number[]).reduce((acc, c) => acc + c, 0);
}
