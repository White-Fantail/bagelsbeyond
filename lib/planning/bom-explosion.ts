/**
 * BOM (Bill of Materials) explosion — pure recursive logic.
 * No I/O; all recipe/ingredient data is passed in as plain objects.
 */

import { calculateEffectiveQuantity } from "@/lib/costing/recipe-cost";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IngredientNode = {
  type: "ingredient";
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  quantity: number; // recipe quantity
  effectiveQuantity: number; // yield-adjusted
  yieldPercent: number;
};

export type ComponentNode = {
  type: "component";
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
};

export type RecipeItemInput = {
  sourceType: "INGREDIENT" | "PRODUCT";
  ingredientId: string | null;
  ingredientName: string | null;
  ingredientBaseUnit: string | null;
  ingredientYieldPercent: number | null;
  componentProductId: string | null;
  componentProductName: string | null;
  quantity: number;
  unit: string;
};

export type RecipeInput = {
  productId: string;
  outputQuantity: number;
  outputUnit: string;
  items: RecipeItemInput[];
};

/** Raw ingredient accumulator entry */
export type RawIngredientEntry = {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  recipeQuantity: number;
  effectiveQuantity: number; // yield-adjusted
};

export type BomExplosionResult = {
  /** Aggregated raw ingredient requirements */
  rawIngredients: Map<string, RawIngredientEntry>;
  /** Component requirements encountered during explosion */
  componentRequirements: Map<string, { productId: string; productName: string; quantity: number; unit: string }>;
};

// ─── Core explosion logic ─────────────────────────────────────────────────────

/**
 * Recursively explode a product's recipe into raw ingredient needs.
 *
 * @param productId       The product to explode
 * @param requiredQty     How many output units of this product are needed
 * @param recipeMap       Map from productId -> RecipeInput (pre-fetched for all products)
 * @param result          Accumulator for raw ingredient and component quantities
 * @param visited         Set of productIds currently in the call stack (cycle guard)
 */
export function explodeRecipe(
  productId: string,
  requiredQty: number,
  recipeMap: Map<string, RecipeInput>,
  result: BomExplosionResult,
  visited: Set<string> = new Set()
): void {
  if (visited.has(productId)) {
    // Cycle detected — skip to prevent infinite recursion
    return;
  }

  const recipe = recipeMap.get(productId);
  if (!recipe || recipe.outputQuantity <= 0) return;

  // How many recipe-batches are needed to produce requiredQty output units
  const batchMultiplier = requiredQty / recipe.outputQuantity;

  visited.add(productId);

  for (const item of recipe.items) {
    const itemQty = item.quantity * batchMultiplier;

    if (item.sourceType === "INGREDIENT" && item.ingredientId) {
      const yieldPct = item.ingredientYieldPercent ?? 100;
      const effectiveQty = calculateEffectiveQuantity(itemQty, yieldPct);

      const existing = result.rawIngredients.get(item.ingredientId);
      if (existing) {
        existing.recipeQuantity += itemQty;
        existing.effectiveQuantity += effectiveQty;
      } else {
        result.rawIngredients.set(item.ingredientId, {
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientName ?? item.ingredientId,
          baseUnit: item.ingredientBaseUnit ?? "EA",
          recipeQuantity: itemQty,
          effectiveQuantity: effectiveQty,
        });
      }
    } else if (item.sourceType === "PRODUCT" && item.componentProductId) {
      // Track component requirement
      const compId = item.componentProductId;
      const existing = result.componentRequirements.get(compId);
      if (existing) {
        existing.quantity += itemQty;
      } else {
        result.componentRequirements.set(compId, {
          productId: compId,
          productName: item.componentProductName ?? compId,
          quantity: itemQty,
          unit: item.unit,
        });
      }

      // Recurse into the component product's own recipe
      explodeRecipe(compId, itemQty, recipeMap, result, new Set(visited));
    }
  }

  visited.delete(productId);
}

/**
 * Aggregate ingredient needs for a list of (productId, requiredQty) pairs.
 */
export function aggregateIngredientNeeds(
  productNeeds: Array<{ productId: string; requiredQty: number }>,
  recipeMap: Map<string, RecipeInput>
): BomExplosionResult {
  const result: BomExplosionResult = {
    rawIngredients: new Map(),
    componentRequirements: new Map(),
  };

  for (const { productId, requiredQty } of productNeeds) {
    if (requiredQty <= 0) continue;
    explodeRecipe(productId, requiredQty, recipeMap, result, new Set());
  }

  return result;
}
