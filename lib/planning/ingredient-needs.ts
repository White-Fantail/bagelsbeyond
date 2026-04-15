import "server-only";
import { prisma } from "@/lib/db";
import { getEffectiveForecastForDate } from "./forecast-input";
import {
  buildProductionRecommendation,
  type ProductionRecommendationOutput,
  type RoundingMode,
  type BatchHandlingMode,
} from "./production-plan";
import { aggregateIngredientNeeds, type BomExplosionResult, type RecipeInput, type RecipeItemInput } from "./bom-explosion";
import { calculateExpectedProfit, type ProfitForecast, type ProductProfitInput } from "./profit-forecast";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanningSettings = {
  bufferPercent: number;
  roundingMode: RoundingMode;
  batchHandlingMode: BatchHandlingMode;
};

export type ProductionPlanRow = {
  productId: string;
  productName: string;
  predictedSalesQty: number;
  hasOverride: boolean;
  sourceType: "MANUAL" | "SYSTEM";
  recommendation: ProductionRecommendationOutput;
  sellingPrice: number | null;
  adjustedUnitCost: number | null;
};

export type ProductionPlan = {
  targetDate: string;
  settings: PlanningSettings;
  products: ProductionPlanRow[];
  bomResult: BomExplosionResult;
  profitForecast: ProfitForecast;
};

// ─── Global settings ──────────────────────────────────────────────────────────

export async function getPlanningSettings(): Promise<PlanningSettings> {
  const settings = await prisma.appSetting.findFirst({
    select: {
      planningBufferPercent: true,
      planningRoundingMode: true,
      planningBatchHandlingMode: true,
    },
  });

  return {
    bufferPercent: settings?.planningBufferPercent ?? 10,
    roundingMode: (settings?.planningRoundingMode ?? "ROUND_UP") as RoundingMode,
    batchHandlingMode: (settings?.planningBatchHandlingMode ?? "ROUND_UP") as BatchHandlingMode,
  };
}

// ─── Recipe map builder ───────────────────────────────────────────────────────

async function buildRecipeMap(productIds: string[]): Promise<Map<string, RecipeInput>> {
  if (productIds.length === 0) return new Map();

  const recipes = await prisma.recipe.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
    },
    include: {
      items: {
        include: {
          ingredient: {
            select: {
              id: true,
              name: true,
              baseUnit: true,
              yieldPercent: true,
            },
          },
          componentProduct: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // Recursively collect all component product IDs
  const componentProductIds = new Set<string>();
  for (const recipe of recipes) {
    for (const item of recipe.items) {
      if (item.sourceType === "PRODUCT" && item.componentProductId) {
        componentProductIds.add(item.componentProductId);
      }
    }
  }

  // Fetch component recipes if not already in set
  const missingIds = [...componentProductIds].filter((id) => !productIds.includes(id));
  if (missingIds.length > 0) {
    const componentRecipes = await prisma.recipe.findMany({
      where: { productId: { in: missingIds }, isActive: true },
      include: {
        items: {
          include: {
            ingredient: {
              select: { id: true, name: true, baseUnit: true, yieldPercent: true },
            },
            componentProduct: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
    recipes.push(...componentRecipes);
  }

  const recipeMap = new Map<string, RecipeInput>();
  for (const recipe of recipes) {
    const items: RecipeItemInput[] = recipe.items.map((item) => ({
      sourceType: item.sourceType as "INGREDIENT" | "PRODUCT",
      ingredientId: item.ingredientId,
      ingredientName: item.ingredient?.name ?? null,
      ingredientBaseUnit: item.ingredient?.baseUnit ?? null,
      ingredientYieldPercent: item.ingredient
        ? parseFloat(item.ingredient.yieldPercent.toString())
        : null,
      componentProductId: item.componentProductId,
      componentProductName: item.componentProduct?.name ?? null,
      quantity: parseFloat(item.quantity.toString()),
      unit: item.unit,
    }));

    recipeMap.set(recipe.productId, {
      productId: recipe.productId,
      outputQuantity: parseFloat(recipe.outputQuantity.toString()),
      outputUnit: recipe.outputUnit,
      items,
    });
  }

  return recipeMap;
}

// ─── Adjusted unit cost helper ────────────────────────────────────────────────

async function getAdjustedUnitCosts(
  productIds: string[]
): Promise<Map<string, number | null>> {
  const { getRecipeCostSummary } = await import("@/lib/services/recipeService");
  const costMap = new Map<string, number | null>();

  await Promise.all(
    productIds.map(async (productId) => {
      const summary = await getRecipeCostSummary(productId);
      if (summary?.adjustedCostPerOutputUnit) {
        costMap.set(productId, parseFloat(summary.adjustedCostPerOutputUnit));
      } else {
        costMap.set(productId, null);
      }
    })
  );

  return costMap;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Builds a full production plan for the target date.
 *
 * Steps:
 * 1. Load effective forecast (manual overrides + plannable products)
 * 2. Load product planning settings (batch size, buffer, rounding)
 * 3. Compute production recommendations per product
 * 4. Explode BOMs into raw ingredient requirements
 * 5. Calculate expected revenue / cost / profit
 */
export async function buildProductionPlan(
  targetDate: Date | string,
  overrideSettings?: Partial<PlanningSettings>
): Promise<ProductionPlan> {
  const dateStr =
    typeof targetDate === "string"
      ? targetDate
      : targetDate.toISOString().slice(0, 10);

  const [globalSettings, forecast] = await Promise.all([
    getPlanningSettings(),
    getEffectiveForecastForDate(dateStr),
  ]);

  const settings: PlanningSettings = {
    bufferPercent: overrideSettings?.bufferPercent ?? globalSettings.bufferPercent,
    roundingMode: overrideSettings?.roundingMode ?? globalSettings.roundingMode,
    batchHandlingMode: overrideSettings?.batchHandlingMode ?? globalSettings.batchHandlingMode,
  };

  const productIds = forecast.map((f) => f.productId);

  // Load product-level planning settings
  const products = await prisma.menuProduct.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      sellingPrice: true,
      productionBatchSize: true,
      productionBufferPercent: true,
      planningRoundingMode: true,
    },
  });
  const productSettingsMap = new Map(products.map((p) => [p.id, p]));

  const [recipeMap, unitCostMap] = await Promise.all([
    buildRecipeMap(productIds),
    getAdjustedUnitCosts(productIds),
  ]);

  // Build plan rows
  const planRows: ProductionPlanRow[] = forecast.map((entry) => {
    const ps = productSettingsMap.get(entry.productId);
    const batchSize = ps?.productionBatchSize ?? null;
    const bufferPercent =
      ps?.productionBufferPercent !== null && ps?.productionBufferPercent !== undefined
        ? ps.productionBufferPercent
        : settings.bufferPercent;
    const roundingMode =
      (ps?.planningRoundingMode as RoundingMode | null) ?? settings.roundingMode;

    const recommendation = buildProductionRecommendation({
      predictedSalesQty: entry.predictedSalesQty,
      bufferPercent,
      batchSize,
      roundingMode,
      batchHandlingMode: settings.batchHandlingMode,
    });

    const sellingPrice =
      ps?.sellingPrice !== null && ps?.sellingPrice !== undefined
        ? parseFloat(ps.sellingPrice.toString())
        : null;
    const adjustedUnitCost = unitCostMap.get(entry.productId) ?? null;

    return {
      productId: entry.productId,
      productName: entry.productName,
      predictedSalesQty: entry.predictedSalesQty,
      hasOverride: entry.hasOverride,
      sourceType: entry.sourceType,
      recommendation,
      sellingPrice,
      adjustedUnitCost,
    };
  });

  // BOM explosion — use recommendedProductionQty for each product
  const productNeeds = planRows.map((r) => ({
    productId: r.productId,
    requiredQty: r.recommendation.recommendedProductionQty,
  }));
  const bomResult = aggregateIngredientNeeds(productNeeds, recipeMap);

  // Profit forecast — use predictedSalesQty (demand) for revenue/cost projections
  const profitInputs: ProductProfitInput[] = planRows.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    predictedSalesQty: r.predictedSalesQty,
    sellingPrice: r.sellingPrice,
    adjustedUnitCost: r.adjustedUnitCost,
  }));
  const profitForecast = calculateExpectedProfit(profitInputs);

  return {
    targetDate: dateStr,
    settings,
    products: planRows,
    bomResult,
    profitForecast,
  };
}
