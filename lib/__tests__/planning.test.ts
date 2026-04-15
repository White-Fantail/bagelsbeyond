import { describe, it, expect } from "vitest";
import {
  applyRounding,
  calculateBufferedTarget,
  calculateBatchCount,
  buildProductionRecommendation,
} from "@/lib/planning/production-plan";
import {
  explodeRecipe,
  aggregateIngredientNeeds,
  type RecipeInput,
  type BomExplosionResult,
} from "@/lib/planning/bom-explosion";
import {
  calculateProductProfit,
  calculateExpectedProfit,
} from "@/lib/planning/profit-forecast";

// ─── applyRounding ────────────────────────────────────────────────────────────

describe("applyRounding", () => {
  it("ROUND_UP rounds fractional values up to next integer", () => {
    expect(applyRounding(20.1, "ROUND_UP")).toBe(21);
    expect(applyRounding(20.9, "ROUND_UP")).toBe(21);
    expect(applyRounding(20.0, "ROUND_UP")).toBe(20);
  });

  it("ROUND_DOWN rounds fractional values down", () => {
    expect(applyRounding(20.9, "ROUND_DOWN")).toBe(20);
    expect(applyRounding(20.0, "ROUND_DOWN")).toBe(20);
  });

  it("ROUND_NEAREST rounds to nearest integer", () => {
    expect(applyRounding(20.5, "ROUND_NEAREST")).toBe(21);
    expect(applyRounding(20.4, "ROUND_NEAREST")).toBe(20);
  });

  it("NONE returns value unchanged", () => {
    expect(applyRounding(20.9, "NONE")).toBe(20.9);
  });
});

// ─── calculateBufferedTarget ──────────────────────────────────────────────────

describe("calculateBufferedTarget", () => {
  it("adds buffer percent to predicted qty", () => {
    // 19 × 1.10 = 20.9
    expect(calculateBufferedTarget(19, 10)).toBeCloseTo(20.9, 5);
  });

  it("zero buffer returns same value", () => {
    expect(calculateBufferedTarget(100, 0)).toBe(100);
  });

  it("100% buffer doubles the quantity", () => {
    expect(calculateBufferedTarget(50, 100)).toBe(100);
  });
});

// ─── calculateBatchCount ──────────────────────────────────────────────────────

describe("calculateBatchCount", () => {
  it("ROUND_UP: ceil(20.9 / 6) = 4", () => {
    expect(calculateBatchCount(20.9, 6, "ROUND_UP")).toBe(4);
  });

  it("ROUND_UP: exact multiple returns exact count", () => {
    expect(calculateBatchCount(24, 6, "ROUND_UP")).toBe(4);
  });

  it("ROUND_NEAREST: rounds to nearest batch count", () => {
    // 7/6 = 1.17 → round → 1
    expect(calculateBatchCount(7, 6, "ROUND_NEAREST")).toBe(1);
    // 10/6 = 1.67 → round → 2
    expect(calculateBatchCount(10, 6, "ROUND_NEAREST")).toBe(2);
  });

  it("ROUND_NEAREST: returns at least 1", () => {
    expect(calculateBatchCount(0.1, 6, "ROUND_NEAREST")).toBe(1);
  });
});

// ─── buildProductionRecommendation ───────────────────────────────────────────

describe("buildProductionRecommendation", () => {
  it("example from spec: predicted=19, buffer=10%, batchSize=6 → production=24", () => {
    const result = buildProductionRecommendation({
      predictedSalesQty: 19,
      bufferPercent: 10,
      batchSize: 6,
      roundingMode: "ROUND_UP",
      batchHandlingMode: "ROUND_UP",
    });

    expect(result.predictedSalesQty).toBe(19);
    expect(result.bufferedTargetQty).toBeCloseTo(20.9, 4);
    expect(result.recommendedBatchCount).toBe(4); // ceil(20.9/6) = 4
    expect(result.recommendedProductionQty).toBe(24); // 4 × 6
    expect(result.batchSize).toBe(6);
  });

  it("no batch size: applies rounding to buffered target", () => {
    const result = buildProductionRecommendation({
      predictedSalesQty: 51,
      bufferPercent: 10,
      batchSize: null,
      roundingMode: "ROUND_UP",
      batchHandlingMode: "ROUND_UP",
    });

    // 51 × 1.1 = 56.1 → ceil = 57
    expect(result.recommendedProductionQty).toBe(57);
    expect(result.recommendedBatchCount).toBeNull();
    expect(result.batchSize).toBeNull();
  });

  it("zero predicted sales returns zero production", () => {
    const result = buildProductionRecommendation({
      predictedSalesQty: 0,
      bufferPercent: 10,
      batchSize: 12,
      roundingMode: "ROUND_UP",
      batchHandlingMode: "ROUND_UP",
    });

    expect(result.predictedSalesQty).toBe(0);
    expect(result.bufferedTargetQty).toBe(0);
    expect(result.recommendedBatchCount).toBe(0); // ceil(0/12)
    expect(result.recommendedProductionQty).toBe(0);
  });

  it("batch handling IGNORE: uses rounding mode on buffered target instead", () => {
    const result = buildProductionRecommendation({
      predictedSalesQty: 19,
      bufferPercent: 10,
      batchSize: 6,
      roundingMode: "ROUND_UP",
      batchHandlingMode: "IGNORE",
    });

    expect(result.recommendedProductionQty).toBe(21); // ceil(20.9)
    expect(result.recommendedBatchCount).toBeNull();
  });
});

// ─── Batch-output recipe support ──────────────────────────────────────────────

describe("batch-output recipe support", () => {
  it("Plain Bagel recipe: output=24 EA, required=50 → 3 batches → 72 output", () => {
    // Simulates: ceil(50/24) = 3 batches → 72 units
    const result = buildProductionRecommendation({
      predictedSalesQty: 50,
      bufferPercent: 0,
      batchSize: 24,
      roundingMode: "NONE",
      batchHandlingMode: "ROUND_UP",
    });

    expect(result.recommendedBatchCount).toBe(3);
    expect(result.recommendedProductionQty).toBe(72);
  });
});

// ─── BOM explosion ────────────────────────────────────────────────────────────

function makeRecipeMap(recipes: RecipeInput[]): Map<string, RecipeInput> {
  return new Map(recipes.map((r) => [r.productId, r]));
}

function emptyBomResult(): BomExplosionResult {
  return {
    rawIngredients: new Map(),
    componentRequirements: new Map(),
  };
}

describe("explodeRecipe — direct ingredient", () => {
  const flourId = "ing-flour";
  const recipeMap = makeRecipeMap([
    {
      productId: "prod-plain-bagel",
      outputQuantity: 24,
      outputUnit: "EA",
      items: [
        {
          sourceType: "INGREDIENT",
          ingredientId: flourId,
          ingredientName: "High Gluten Flour",
          ingredientBaseUnit: "G",
          ingredientYieldPercent: 100,
          componentProductId: null,
          componentProductName: null,
          quantity: 1000,
          unit: "G",
        },
      ],
    },
  ]);

  it("explodes 24 output units: 1 batch, 1000 G flour", () => {
    const result = emptyBomResult();
    explodeRecipe("prod-plain-bagel", 24, recipeMap, result);
    const flour = result.rawIngredients.get(flourId);
    expect(flour).toBeDefined();
    expect(flour!.recipeQuantity).toBeCloseTo(1000, 3);
    expect(flour!.effectiveQuantity).toBeCloseTo(1000, 3);
  });

  it("scales correctly for 48 output units (2 batches)", () => {
    const result = emptyBomResult();
    explodeRecipe("prod-plain-bagel", 48, recipeMap, result);
    const flour = result.rawIngredients.get(flourId);
    expect(flour!.recipeQuantity).toBeCloseTo(2000, 3);
  });
});

describe("explodeRecipe — yield adjustment", () => {
  const salmonId = "ing-salmon";
  const recipeMap = makeRecipeMap([
    {
      productId: "prod-salmon-bagel",
      outputQuantity: 1,
      outputUnit: "EA",
      items: [
        {
          sourceType: "INGREDIENT",
          ingredientId: salmonId,
          ingredientName: "Smoked Salmon",
          ingredientBaseUnit: "G",
          ingredientYieldPercent: 80, // 20% trim loss
          componentProductId: null,
          componentProductName: null,
          quantity: 100,
          unit: "G",
        },
      ],
    },
  ]);

  it("yield=80%: effective quantity = recipe_qty / 0.80", () => {
    const result = emptyBomResult();
    explodeRecipe("prod-salmon-bagel", 10, recipeMap, result);
    const salmon = result.rawIngredients.get(salmonId);
    // recipe qty = 100 × 10 = 1000; effective = 1000 / 0.8 = 1250
    expect(salmon!.recipeQuantity).toBeCloseTo(1000, 3);
    expect(salmon!.effectiveQuantity).toBeCloseTo(1250, 3);
  });
});

describe("explodeRecipe — recursive component product", () => {
  const flourId = "ing-flour";
  const recipeMap = makeRecipeMap([
    // Plain Bagel: 24 EA output, uses 1000 G flour
    {
      productId: "prod-plain-bagel",
      outputQuantity: 24,
      outputUnit: "EA",
      items: [
        {
          sourceType: "INGREDIENT",
          ingredientId: flourId,
          ingredientName: "High Gluten Flour",
          ingredientBaseUnit: "G",
          ingredientYieldPercent: 100,
          componentProductId: null,
          componentProductName: null,
          quantity: 1000,
          unit: "G",
        },
      ],
    },
    // Smoked Salmon Bagel: uses 1 Plain Bagel component + salmon
    {
      productId: "prod-smoked-salmon-bagel",
      outputQuantity: 1,
      outputUnit: "EA",
      items: [
        {
          sourceType: "PRODUCT",
          ingredientId: null,
          ingredientName: null,
          ingredientBaseUnit: null,
          ingredientYieldPercent: null,
          componentProductId: "prod-plain-bagel",
          componentProductName: "Plain Bagel",
          quantity: 1,
          unit: "EA",
        },
      ],
    },
  ]);

  it("explodes smoked salmon bagel demand into plain bagel component + flour", () => {
    const result = emptyBomResult();
    explodeRecipe("prod-smoked-salmon-bagel", 48, recipeMap, result);

    // 48 smoked salmon bagels → 48 plain bagels → ceil(48/24) = 2 batches → 2000 G flour
    expect(result.componentRequirements.has("prod-plain-bagel")).toBe(true);
    const plainBagelComp = result.componentRequirements.get("prod-plain-bagel")!;
    expect(plainBagelComp.quantity).toBeCloseTo(48, 3);

    const flour = result.rawIngredients.get(flourId);
    expect(flour).toBeDefined();
    // 48 bagels / 24 per batch = 2 batches × 1000 G = 2000 G
    expect(flour!.recipeQuantity).toBeCloseTo(2000, 3);
  });
});

describe("explodeRecipe — cycle prevention", () => {
  it("does not infinite-loop when cycle exists (A → B → A)", () => {
    const recipeMap = makeRecipeMap([
      {
        productId: "prod-a",
        outputQuantity: 1,
        outputUnit: "EA",
        items: [
          {
            sourceType: "PRODUCT",
            ingredientId: null,
            ingredientName: null,
            ingredientBaseUnit: null,
            ingredientYieldPercent: null,
            componentProductId: "prod-b",
            componentProductName: "B",
            quantity: 1,
            unit: "EA",
          },
        ],
      },
      {
        productId: "prod-b",
        outputQuantity: 1,
        outputUnit: "EA",
        items: [
          {
            sourceType: "PRODUCT",
            ingredientId: null,
            ingredientName: null,
            ingredientBaseUnit: null,
            ingredientYieldPercent: null,
            componentProductId: "prod-a",
            componentProductName: "A",
            quantity: 1,
            unit: "EA",
          },
        ],
      },
    ]);

    const result = emptyBomResult();
    // Should return without throwing or hanging
    expect(() => explodeRecipe("prod-a", 10, recipeMap, result)).not.toThrow();
  });
});

describe("aggregateIngredientNeeds — multiple products", () => {
  const flourId = "ing-flour";
  const waterId = "ing-water";

  const recipeMap = makeRecipeMap([
    {
      productId: "prod-a",
      outputQuantity: 1,
      outputUnit: "EA",
      items: [
        {
          sourceType: "INGREDIENT",
          ingredientId: flourId,
          ingredientName: "Flour",
          ingredientBaseUnit: "G",
          ingredientYieldPercent: 100,
          componentProductId: null,
          componentProductName: null,
          quantity: 200,
          unit: "G",
        },
      ],
    },
    {
      productId: "prod-b",
      outputQuantity: 1,
      outputUnit: "EA",
      items: [
        {
          sourceType: "INGREDIENT",
          ingredientId: flourId,
          ingredientName: "Flour",
          ingredientBaseUnit: "G",
          ingredientYieldPercent: 100,
          componentProductId: null,
          componentProductName: null,
          quantity: 300,
          unit: "G",
        },
        {
          sourceType: "INGREDIENT",
          ingredientId: waterId,
          ingredientName: "Water",
          ingredientBaseUnit: "ML",
          ingredientYieldPercent: 100,
          componentProductId: null,
          componentProductName: null,
          quantity: 100,
          unit: "ML",
        },
      ],
    },
  ]);

  it("aggregates flour from two products correctly", () => {
    const result = aggregateIngredientNeeds(
      [
        { productId: "prod-a", requiredQty: 10 }, // 10 × 200 = 2000 G flour
        { productId: "prod-b", requiredQty: 5 },  // 5 × 300 = 1500 G flour
      ],
      recipeMap
    );

    const flour = result.rawIngredients.get(flourId);
    expect(flour!.recipeQuantity).toBeCloseTo(3500, 3); // 2000 + 1500
    const water = result.rawIngredients.get(waterId);
    expect(water!.recipeQuantity).toBeCloseTo(500, 3); // 5 × 100
  });
});

// ─── Profit forecast ──────────────────────────────────────────────────────────

describe("calculateProductProfit", () => {
  it("calculates revenue, cost, and gross profit correctly", () => {
    const result = calculateProductProfit({
      productId: "p1",
      productName: "Plain Bagel",
      predictedSalesQty: 100,
      sellingPrice: 4.5,
      adjustedUnitCost: 1.2,
    });

    expect(result.predictedRevenue).toBeCloseTo(450, 2);
    expect(result.expectedCost).toBeCloseTo(120, 2);
    expect(result.expectedGrossProfit).toBeCloseTo(330, 2);
    expect(result.grossMarginPercent).toBeCloseTo(73.33, 1);
  });

  it("returns nulls when sellingPrice is null", () => {
    const result = calculateProductProfit({
      productId: "p1",
      productName: "Test",
      predictedSalesQty: 50,
      sellingPrice: null,
      adjustedUnitCost: 1.0,
    });

    expect(result.predictedRevenue).toBeNull();
    expect(result.expectedGrossProfit).toBeNull();
    expect(result.grossMarginPercent).toBeNull();
    // Cost is still calculable
    expect(result.expectedCost).toBeCloseTo(50, 2);
  });

  it("returns null cost when adjustedUnitCost is null", () => {
    const result = calculateProductProfit({
      productId: "p1",
      productName: "Test",
      predictedSalesQty: 50,
      sellingPrice: 5.0,
      adjustedUnitCost: null,
    });

    expect(result.predictedRevenue).toBeCloseTo(250, 2);
    expect(result.expectedCost).toBeNull();
    expect(result.expectedGrossProfit).toBeNull();
  });
});

describe("calculateExpectedProfit — totals", () => {
  it("aggregates revenue, cost, and gross profit across products", () => {
    const result = calculateExpectedProfit([
      {
        productId: "p1",
        productName: "Product A",
        predictedSalesQty: 100,
        sellingPrice: 5.0,
        adjustedUnitCost: 1.5,
      },
      {
        productId: "p2",
        productName: "Product B",
        predictedSalesQty: 50,
        sellingPrice: 8.0,
        adjustedUnitCost: 2.0,
      },
    ]);

    // P1: rev=500, cost=150, profit=350
    // P2: rev=400, cost=100, profit=300
    // Total: rev=900, cost=250, profit=650
    expect(result.totals.totalPredictedRevenue).toBeCloseTo(900, 2);
    expect(result.totals.totalExpectedCost).toBeCloseTo(250, 2);
    expect(result.totals.totalExpectedGrossProfit).toBeCloseTo(650, 2);
    expect(result.totals.overallGrossMarginPercent).toBeCloseTo(72.22, 1);
  });

  it("handles products with no costing data gracefully", () => {
    const result = calculateExpectedProfit([
      {
        productId: "p1",
        productName: "Costed Product",
        predictedSalesQty: 100,
        sellingPrice: 5.0,
        adjustedUnitCost: 1.5,
      },
      {
        productId: "p2",
        productName: "Uncosted Product",
        predictedSalesQty: 50,
        sellingPrice: null,
        adjustedUnitCost: null,
      },
    ]);

    expect(result.totals.totalPredictedRevenue).toBeCloseTo(500, 2);
    expect(result.products[1].predictedRevenue).toBeNull();
  });
});
