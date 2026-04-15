import "server-only";
import { prisma } from "@/lib/db";
import { RecipeItemSourceType, UnitType } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";

import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";
import { getEffectivePricingTarget, buildProductPricingSummary } from "@/lib/costing/pricing";
import { calculateEffectiveQuantity } from "@/lib/costing/recipe-cost";

import {
  buildIngredientSupplierComparison,
  getCheaperAlternateSuppliers,
  getSupplierSyncIssues,
  type IngredientSupplierComparison,
  type SupplierLinkSnapshot,
  type CheaperAlternateEntry,
  type SyncIssueEntry,
} from "@/lib/costing/analysis/ingredient-comparison";

import {
  computeMovementDelta,
  sortByBiggestIncrease,
  sortByBiggestDecrease,
  filterRecentlyUpdated,
  buildStaleIngredients,
  type IngredientMovementRow,
  type StaleIngredientRow,
  type HistoryEntryInput,
} from "@/lib/costing/analysis/price-movements";

import {
  computeProductImpact,
  sortByAbsoluteCostDelta,
  type ProductImpactRow,
} from "@/lib/costing/analysis/menu-impact";

import {
  buildPricingHealthSummary,
  extractTargetPercents,
  computePriceGapPct,
  type ProductHealthRow,
  type PricingHealthSummary,
} from "@/lib/costing/analysis/pricing-health";

import { getGlobalPricingSettings } from "@/lib/services/pricingService";

export type {
  IngredientSupplierComparison,
  CheaperAlternateEntry,
  SyncIssueEntry,
  IngredientMovementRow,
  StaleIngredientRow,
  ProductImpactRow,
  ProductHealthRow,
  PricingHealthSummary,
};

// ─── Supplier Comparison ──────────────────────────────────────────────────────

/**
 * Builds supplier comparison analysis for a single ingredient.
 */
export async function getIngredientSupplierComparison(
  ingredientId: string
): Promise<IngredientSupplierComparison | null> {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    select: {
      id: true,
      name: true,
      purchasePrice: true,
      purchaseQuantity: true,
      purchaseUnit: true,
      baseUnit: true,
      supplierLinks: {
        where: { isActive: true },
        include: {
          supplier: { select: { id: true, name: true } },
          priceHistoryLinks: {
            orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              purchasePrice: true,
              purchaseQuantity: true,
              purchaseUnit: true,
              baseUnit: true,
              effectiveFrom: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!ingredient) return null;

  const links: SupplierLinkSnapshot[] = ingredient.supplierLinks.map((link) => {
    const latestHistory = link.priceHistoryLinks[0] ?? null;
    return {
      id: link.id,
      supplierId: link.supplierId,
      supplierName: link.supplier.name,
      supplierProductName: link.supplierProductName,
      supplierProductCode: link.supplierProductCode,
      purchasePrice: parseFloat(ingredient.purchasePrice.toString()),
      purchaseQuantity: parseFloat(ingredient.purchaseQuantity.toString()),
      purchaseUnit: ingredient.purchaseUnit,
      baseUnit: ingredient.baseUnit,
      supplierPackageQuantity: link.supplierPackageQuantity
        ? parseFloat(link.supplierPackageQuantity.toString())
        : null,
      supplierPackageUnit: link.supplierPackageUnit,
      supplierBaseUnit: link.supplierBaseUnit,
      isPrimary: link.isPrimary,
      isActive: link.isActive,
      syncMode: link.syncMode,
      lastCheckedAt: link.lastCheckedAt ? link.lastCheckedAt.toISOString() : null,
      lastSyncStatus: link.lastSyncStatus,
      lastSyncedPrice: latestHistory ? parseFloat(latestHistory.purchasePrice.toString()) : null,
      lastSyncedQuantity: latestHistory
        ? parseFloat(latestHistory.purchaseQuantity.toString())
        : null,
      lastSyncedUnit: latestHistory ? (latestHistory.purchaseUnit as UnitType) : null,
      lastSyncedBaseUnit: latestHistory ? (latestHistory.baseUnit as UnitType) : null,
      lastSyncedAt: latestHistory ? latestHistory.effectiveFrom.toISOString() : null,
    };
  });

  return buildIngredientSupplierComparison(ingredientId, ingredient.name, links);
}

/**
 * Returns cheaper alternate supplier entries across all ingredients.
 */
export async function getCheaperAlternateSuppliersGlobal(): Promise<CheaperAlternateEntry[]> {
  const ingredients = await prisma.ingredient.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const comparisons = await Promise.all(
    ingredients.map((i) => getIngredientSupplierComparison(i.id))
  );

  const valid = comparisons.filter((c): c is IngredientSupplierComparison => c !== null);
  return getCheaperAlternateSuppliers(valid);
}

/**
 * Returns supplier links with sync issues across all ingredients.
 */
export async function getSupplierSyncIssuesGlobal(): Promise<SyncIssueEntry[]> {
  const ingredients = await prisma.ingredient.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const comparisons = await Promise.all(
    ingredients.map((i) => getIngredientSupplierComparison(i.id))
  );

  const valid = comparisons.filter((c): c is IngredientSupplierComparison => c !== null);
  return getSupplierSyncIssues(valid);
}

// ─── Price Movement Analysis ──────────────────────────────────────────────────

type MovementFilters = {
  /** ISO date string; only include ingredients updated since this date */
  since?: string;
  /** Max number of results per category */
  limit?: number;
};

type PriceMovementsResult = {
  recentlyUpdated: IngredientMovementRow[];
  biggestIncreases: IngredientMovementRow[];
  biggestDecreases: IngredientMovementRow[];
  staleIngredients: StaleIngredientRow[];
};

/**
 * Returns recent ingredient price movement analysis.
 * Uses the latest and immediately previous history entries for each ingredient.
 */
export async function getRecentIngredientPriceMovements(
  filters: MovementFilters = {}
): Promise<PriceMovementsResult> {
  const { since, limit = 20 } = filters;

  // Load all active ingredients with their last two price history entries
  const ingredients = await prisma.ingredient.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      purchasePrice: true,
      purchaseQuantity: true,
      purchaseUnit: true,
      baseUnit: true,
      priceHistory: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 2,
        select: {
          id: true,
          ingredientId: true,
          purchasePrice: true,
          purchaseQuantity: true,
          purchaseUnit: true,
          baseUnit: true,
          yieldPercent: true,
          sourceType: true,
          effectiveFrom: true,
          createdAt: true,
        },
      },
    },
  });

  const allMovements: IngredientMovementRow[] = [];
  const ingredientLastUpdate: Array<{
    ingredientId: string;
    ingredientName: string;
    lastUpdatedAt: string | null;
  }> = [];

  for (const ing of ingredients) {
    const [latest, previous] = ing.priceHistory;
    const lastUpdatedAt = latest ? latest.effectiveFrom.toISOString() : null;

    ingredientLastUpdate.push({
      ingredientId: ing.id,
      ingredientName: ing.name,
      lastUpdatedAt,
    });

    if (!latest) continue;

    const toHistoryInput = (r: typeof latest): HistoryEntryInput => ({
      id: r.id,
      ingredientId: r.ingredientId,
      purchasePrice: parseFloat(r.purchasePrice.toString()),
      purchaseQuantity: parseFloat(r.purchaseQuantity.toString()),
      purchaseUnit: r.purchaseUnit as UnitType,
      baseUnit: r.baseUnit as UnitType,
      yieldPercent: parseFloat(r.yieldPercent.toString()),
      sourceType: r.sourceType,
      effectiveFrom: r.effectiveFrom.toISOString(),
      createdAt: r.createdAt.toISOString(),
    });

    const movement = computeMovementDelta(
      ing.id,
      ing.name,
      toHistoryInput(latest),
      previous ? toHistoryInput(previous) : null
    );
    allMovements.push(movement);
  }

  const recentlyUpdated = filterRecentlyUpdated(allMovements, 7).slice(0, limit);
  const biggestIncreases = sortByBiggestIncrease(allMovements).slice(0, limit);
  const biggestDecreases = sortByBiggestDecrease(allMovements).slice(0, limit);
  const staleIngredients = buildStaleIngredients(ingredientLastUpdate);

  if (since) {
    const sinceDate = new Date(since);
    const isRecent = (row: IngredientMovementRow) => new Date(row.lastUpdatedAt) >= sinceDate;
    return {
      recentlyUpdated: recentlyUpdated.filter(isRecent),
      biggestIncreases: biggestIncreases.filter(isRecent),
      biggestDecreases: biggestDecreases.filter(isRecent),
      staleIngredients,
    };
  }

  return { recentlyUpdated, biggestIncreases, biggestDecreases, staleIngredients };
}

// ─── Ingredient Impact on Recipes ─────────────────────────────────────────────

/**
 * Returns products/recipes that use the given ingredient and shows the cost impact
 * of the most recent price change for that ingredient.
 */
export async function getIngredientImpactOnRecipes(
  ingredientId: string
): Promise<ProductImpactRow[]> {
  // Load ingredient with last two history entries
  const ingredient = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    select: {
      id: true,
      purchasePrice: true,
      purchaseQuantity: true,
      purchaseUnit: true,
      baseUnit: true,
      yieldPercent: true,
      priceHistory: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 2,
        select: {
          purchasePrice: true,
          purchaseQuantity: true,
          purchaseUnit: true,
          baseUnit: true,
          yieldPercent: true,
        },
      },
    },
  });

  if (!ingredient) return [];

  const [latestHistory, previousHistory] = ingredient.priceHistory;

  // Current standard unit cost (from current ingredient master)
  const currentCostResult = calculateStandardUnitCost(
    parseFloat(ingredient.purchasePrice.toString()),
    parseFloat(ingredient.purchaseQuantity.toString()),
    ingredient.purchaseUnit,
    ingredient.baseUnit
  );
  const currentStandardUnitCost = currentCostResult.isConvertible
    ? currentCostResult.standardUnitCost
    : null;

  // Previous standard unit cost (from second latest history entry)
  let previousStandardUnitCost: number | null = null;
  if (previousHistory) {
    const prevResult = calculateStandardUnitCost(
      parseFloat(previousHistory.purchasePrice.toString()),
      parseFloat(previousHistory.purchaseQuantity.toString()),
      previousHistory.purchaseUnit as UnitType,
      previousHistory.baseUnit as UnitType
    );
    previousStandardUnitCost = prevResult.isConvertible ? prevResult.standardUnitCost : null;
  } else if (latestHistory) {
    // Only one history entry — use it as both current and previous (no delta)
    const prevResult = calculateStandardUnitCost(
      parseFloat(latestHistory.purchasePrice.toString()),
      parseFloat(latestHistory.purchaseQuantity.toString()),
      latestHistory.purchaseUnit as UnitType,
      latestHistory.baseUnit as UnitType
    );
    previousStandardUnitCost = prevResult.isConvertible ? prevResult.standardUnitCost : null;
  }

  // Find all active recipes that directly use this ingredient
  const recipeItems = await prisma.recipeItem.findMany({
    where: {
      ingredientId,
      sourceType: RecipeItemSourceType.INGREDIENT,
      recipe: { isActive: true },
    },
    select: {
      id: true,
      quantity: true,
      recipe: {
        select: {
          id: true,
          productId: true,
          outputQuantity: true,
          outputUnit: true,
          product: {
            select: {
              id: true,
              name: true,
              sellingPrice: true,
              pricingTargetType: true,
              pricingTargetPercent: true,
            },
          },
          // All items in the recipe for full batch cost
          items: {
            where: { sourceType: RecipeItemSourceType.INGREDIENT },
            select: {
              quantity: true,
              ingredientId: true,
              ingredient: {
                select: {
                  id: true,
                  purchasePrice: true,
                  purchaseQuantity: true,
                  purchaseUnit: true,
                  baseUnit: true,
                  yieldPercent: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const globalSettings = await getGlobalPricingSettings();

  const results: ProductImpactRow[] = [];

  for (const item of recipeItems) {
    const recipe = item.recipe;
    const product = recipe.product;
    const usageQty = parseFloat((item.quantity as Prisma.Decimal).toString());
    const ingredientYieldPct = parseFloat(ingredient.yieldPercent.toString());
    const outputQty = parseFloat(recipe.outputQuantity.toString());

    // Compute current and previous batch costs by summing all ingredient items
    let currentBatchCost = 0;
    let previousBatchCost = 0;
    let costingComplete = true;

    for (const ri of recipe.items) {
      if (!ri.ingredient) { costingComplete = false; continue; }

      const riPrice = parseFloat(ri.ingredient.purchasePrice.toString());
      const riQty = parseFloat(ri.ingredient.purchaseQuantity.toString());
      const riYield = parseFloat(ri.ingredient.yieldPercent.toString());
      const riAmount = parseFloat((ri.quantity as Prisma.Decimal).toString());
      const effectiveRiQty = calculateEffectiveQuantity(riAmount, riYield);

      // For this ingredient, use previous/current costs
      if (ri.ingredientId === ingredientId) {
        if (currentStandardUnitCost === null) {
          costingComplete = false;
        } else {
          currentBatchCost += effectiveRiQty * currentStandardUnitCost;
        }
        if (previousStandardUnitCost === null) {
          costingComplete = false;
        } else {
          previousBatchCost += effectiveRiQty * previousStandardUnitCost;
        }
      } else {
        // Use the ingredient's current standard unit cost for all other items
        const costRes = calculateStandardUnitCost(riPrice, riQty, ri.ingredient.purchaseUnit, ri.ingredient.baseUnit);
        if (!costRes.isConvertible) {
          costingComplete = false;
        } else {
          const lineCost = effectiveRiQty * costRes.standardUnitCost;
          currentBatchCost += lineCost;
          previousBatchCost += lineCost;
        }
      }
    }

    const finalCurrentBatch = costingComplete ? currentBatchCost : null;
    const finalPreviousBatch = costingComplete ? previousBatchCost : null;

    const sellingPrice = product.sellingPrice ? parseFloat(product.sellingPrice.toString()) : null;
    const target = getEffectivePricingTarget(
      {
        pricingTargetType: product.pricingTargetType,
        pricingTargetPercent: product.pricingTargetPercent?.toString() ?? null,
      },
      globalSettings
    );

    const row = computeProductImpact(
      product.id,
      product.name,
      sellingPrice,
      usageQty,
      ingredientYieldPct,
      previousStandardUnitCost,
      currentStandardUnitCost,
      finalPreviousBatch,
      finalCurrentBatch,
      outputQty,
      target
    );

    results.push(row);
  }

  return sortByAbsoluteCostDelta(results);
}

// ─── Pricing Health ───────────────────────────────────────────────────────────

export type ProductsHealthFilter = {
  isActive?: boolean;
};

/**
 * Builds a full product-level pricing health list.
 */
export async function getProductPricingHealth(
  filter: ProductsHealthFilter = {}
): Promise<ProductHealthRow[]> {
  const products = await prisma.menuProduct.findMany({
    where: {
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      sellingPrice: true,
      pricingTargetType: true,
      pricingTargetPercent: true,
    },
    orderBy: { name: "asc" },
  });

  if (products.length === 0) return [];

  const globalSettings = await getGlobalPricingSettings();

  // Get adjusted cost per unit for each product via its recipe
  const productIds = products.map((p) => p.id);

  // Batch-load active recipes with items (both INGREDIENT and PRODUCT source types)
  const recipes = await prisma.recipe.findMany({
    where: { productId: { in: productIds }, isActive: true },
    select: {
      productId: true,
      outputQuantity: true,
      items: {
        select: {
          sourceType: true,
          quantity: true,
          componentProductId: true,
          ingredient: {
            select: {
              purchasePrice: true,
              purchaseQuantity: true,
              purchaseUnit: true,
              baseUnit: true,
              yieldPercent: true,
            },
          },
        },
      },
    },
  });

  // Collect all component product IDs used across all recipes
  const componentProductIds = new Set<string>();
  for (const recipe of recipes) {
    for (const item of recipe.items) {
      if (item.sourceType === RecipeItemSourceType.PRODUCT && item.componentProductId) {
        componentProductIds.add(item.componentProductId);
      }
    }
  }

  // Resolve per-unit cost for each component product via its own active recipe
  const componentCostMap = new Map<string, number | null>();
  if (componentProductIds.size > 0) {
    const componentRecipes = await prisma.recipe.findMany({
      where: { productId: { in: [...componentProductIds] }, isActive: true },
      select: {
        productId: true,
        outputQuantity: true,
        items: {
          where: { sourceType: RecipeItemSourceType.INGREDIENT },
          select: {
            quantity: true,
            ingredient: {
              select: {
                purchasePrice: true,
                purchaseQuantity: true,
                purchaseUnit: true,
                baseUnit: true,
                yieldPercent: true,
              },
            },
          },
        },
      },
    });

    for (const recipe of componentRecipes) {
      let batchCost = 0;
      let complete = true;
      const outputQty = parseFloat(recipe.outputQuantity.toString());

      for (const item of recipe.items) {
        if (!item.ingredient) { complete = false; break; }
        const price = parseFloat(item.ingredient.purchasePrice.toString());
        const qty = parseFloat(item.ingredient.purchaseQuantity.toString());
        const yield_ = parseFloat(item.ingredient.yieldPercent.toString());
        const amount = parseFloat((item.quantity as Prisma.Decimal).toString());
        const effectiveQty = calculateEffectiveQuantity(amount, yield_);
        const costRes = calculateStandardUnitCost(price, qty, item.ingredient.purchaseUnit, item.ingredient.baseUnit);
        if (!costRes.isConvertible) { complete = false; break; }
        batchCost += effectiveQty * costRes.standardUnitCost;
      }

      componentCostMap.set(
        recipe.productId,
        complete && outputQty > 0 ? batchCost / outputQty : null
      );
    }
  }

  // Build a map of productId → adjustedCostPerUnit
  const costMap = new Map<string, number | null>();
  for (const recipe of recipes) {
    let batchCost = 0;
    let complete = true;
    const outputQty = parseFloat(recipe.outputQuantity.toString());

    for (const item of recipe.items) {
      const amount = parseFloat((item.quantity as Prisma.Decimal).toString());

      if (item.sourceType === RecipeItemSourceType.PRODUCT) {
        if (!item.componentProductId) { complete = false; break; }
        const componentUnitCost = componentCostMap.get(item.componentProductId) ?? null;
        if (componentUnitCost === null) { complete = false; break; }
        batchCost += amount * componentUnitCost;
      } else {
        // INGREDIENT
        if (!item.ingredient) { complete = false; break; }
        const price = parseFloat(item.ingredient.purchasePrice.toString());
        const qty = parseFloat(item.ingredient.purchaseQuantity.toString());
        const yield_ = parseFloat(item.ingredient.yieldPercent.toString());
        const effectiveQty = calculateEffectiveQuantity(amount, yield_);
        const costRes = calculateStandardUnitCost(price, qty, item.ingredient.purchaseUnit, item.ingredient.baseUnit);
        if (!costRes.isConvertible) { complete = false; break; }
        batchCost += effectiveQty * costRes.standardUnitCost;
      }
    }

    costMap.set(
      recipe.productId,
      complete && outputQty > 0 ? batchCost / outputQty : null
    );
  }

  const rows: ProductHealthRow[] = products.map((p) => {
    const adjustedCostPerUnit = costMap.get(p.id) ?? null;
    const sellingPrice = p.sellingPrice ? parseFloat(p.sellingPrice.toString()) : null;
    const target = getEffectivePricingTarget(
      { pricingTargetType: p.pricingTargetType, pricingTargetPercent: p.pricingTargetPercent?.toString() ?? null },
      globalSettings
    );

    const summary = buildProductPricingSummary({
      sellingPrice,
      adjustedCost: adjustedCostPerUnit,
      product: { pricingTargetType: p.pricingTargetType, pricingTargetPercent: p.pricingTargetPercent?.toString() ?? null },
      globalSettings,
    });

    const { targetMarginPercent, targetCostPercent } = extractTargetPercents(target);

    return {
      productId: p.id,
      productName: p.name,
      sellingPrice,
      adjustedCostPerUnit,
      actualCostPercent: summary.actualCostPercent,
      actualMarginPercent: summary.actualMarginPercent,
      targetMarginPercent,
      targetCostPercent,
      effectiveTarget: target,
      recommendedPrice: summary.recommendedPrice,
      priceGap: summary.priceGap,
      pricingStatus: summary.pricingStatus,
      priceGapPct: computePriceGapPct(summary.priceGap, summary.recommendedPrice),
    };
  });

  return rows;
}

/**
 * Returns the pricing health summary.
 */
export async function getProductsBelowTargetMargin(
  filter: ProductsHealthFilter = {}
): Promise<ProductHealthRow[]> {
  const rows = await getProductPricingHealth(filter);
  return rows.filter((r) => r.pricingStatus === "BELOW_TARGET");
}

/**
 * Returns full pricing health summary with categories.
 */
export async function getFullPricingHealthSummary(
  filter: ProductsHealthFilter = {}
): Promise<PricingHealthSummary> {
  const rows = await getProductPricingHealth(filter);
  return buildPricingHealthSummary(rows);
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export type CostingDashboardSummary = {
  ingredientsUpdatedLast7Days: number;
  biggestIncrease: IngredientMovementRow | null;
  biggestDecrease: IngredientMovementRow | null;
  productsBelowTargetCount: number;
  supplierSyncIssueCount: number;
  cheaperAlternateCount: number;
};

/**
 * Builds the costing dashboard summary cards.
 */
export async function getCostingDashboardSummary(): Promise<CostingDashboardSummary> {
  const [movements, cheaperAlts, syncIssues, healthRows] = await Promise.all([
    getRecentIngredientPriceMovements({ limit: 5 }),
    getCheaperAlternateSuppliersGlobal(),
    getSupplierSyncIssuesGlobal(),
    getProductsBelowTargetMargin({ isActive: true }),
  ]);

  return {
    ingredientsUpdatedLast7Days: movements.recentlyUpdated.length,
    biggestIncrease: movements.biggestIncreases[0] ?? null,
    biggestDecrease: movements.biggestDecreases[0] ?? null,
    productsBelowTargetCount: healthRows.length,
    supplierSyncIssueCount: syncIssues.length,
    cheaperAlternateCount: cheaperAlts.length,
  };
}

/**
 * Returns the biggest product cost increases based on most recently changed ingredients.
 */
export async function getLargestProductCostIncreases(limit = 10): Promise<ProductImpactRow[]> {
  const movements = await getRecentIngredientPriceMovements({ limit: 10 });
  const increasedIngredients = movements.biggestIncreases.slice(0, 5);

  const allImpacts: ProductImpactRow[] = [];
  await Promise.all(
    increasedIngredients.map(async (m) => {
      const impacts = await getIngredientImpactOnRecipes(m.ingredientId);
      allImpacts.push(...impacts.filter((i) => i.costDelta !== null && i.costDelta > 0));
    })
  );

  return sortByAbsoluteCostDelta(allImpacts).slice(0, limit);
}
