import { describe, it, expect } from "vitest";
import { UnitType } from "@/app/generated/prisma/enums";
import {
  calculateRecipeItemCost,
  calculateRecipeTotalCost,
  calculateEffectiveQuantity,
  calculateAdjustedLineCost,
  calculateCostPerOutputUnit,
  calculateComponentProductLineCost,
} from "@/lib/costing/recipe-cost";
import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";
import { recipeItemSchema, recipeSchema } from "@/lib/validations";

// ─── calculateRecipeItemCost ──────────────────────────────────────────────────

describe("calculateRecipeItemCost — basic examples", () => {
  it("returns quantity × standardUnitCost", () => {
    // flour: 500 G × $0.00192/G = $0.96
    const cost = calculateRecipeItemCost(500, 0.00192);
    expect(cost).toBeCloseTo(0.96, 5);
  });

  it("returns null when standardUnitCost is null", () => {
    expect(calculateRecipeItemCost(500, null)).toBeNull();
  });

  it("returns 0 for zero quantity (edge case)", () => {
    expect(calculateRecipeItemCost(0, 0.00192)).toBe(0);
  });

  it("handles small decimal quantities correctly", () => {
    // cream cheese: 0.05 L × $7.25/L = $0.3625
    const cost = calculateRecipeItemCost(0.05, 7.25);
    expect(cost).toBeCloseTo(0.3625, 4);
  });
});

// ─── calculateRecipeTotalCost ─────────────────────────────────────────────────

describe("calculateRecipeTotalCost", () => {
  it("sums all line costs correctly", () => {
    const total = calculateRecipeTotalCost([0.96, 0.3625, 0.05]);
    expect(total).toBeCloseTo(1.3725, 4);
  });

  it("returns null if any line cost is null", () => {
    expect(calculateRecipeTotalCost([0.96, null, 0.05])).toBeNull();
  });

  it("returns null for all-null array", () => {
    expect(calculateRecipeTotalCost([null, null])).toBeNull();
  });

  it("returns 0 for empty array", () => {
    expect(calculateRecipeTotalCost([])).toBe(0);
  });

  it("handles a single item", () => {
    expect(calculateRecipeTotalCost([1.5])).toBeCloseTo(1.5, 4);
  });
});

// ─── Integration: standard unit cost → line cost → total ─────────────────────

describe("Full costing pipeline — classic bagel example", () => {
  // Ingredients:
  //   - High Gluten Flour: 25 KG @ $48.00 → baseUnit G → std cost $0.00192/G
  //   - Cream Cheese: 2 L @ $14.50 → baseUnit ML → std cost $0.00725/ML
  //   - Sesame Seeds: 1 KG @ $12.00 → baseUnit G → std cost $0.012/G

  const flourResult = calculateStandardUnitCost(48.0, 25, UnitType.KG, UnitType.G);
  const creamResult = calculateStandardUnitCost(14.5, 2, UnitType.L, UnitType.ML);
  const sesameResult = calculateStandardUnitCost(12.0, 1, UnitType.KG, UnitType.G);

  it("flour standard unit cost is ~$0.00192/G", () => {
    expect(flourResult.isConvertible).toBe(true);
    if (flourResult.isConvertible) {
      expect(flourResult.standardUnitCost).toBeCloseTo(0.00192, 5);
    }
  });

  it("cream cheese standard unit cost is ~$0.00725/ML", () => {
    expect(creamResult.isConvertible).toBe(true);
    if (creamResult.isConvertible) {
      expect(creamResult.standardUnitCost).toBeCloseTo(0.00725, 5);
    }
  });

  it("sesame seeds standard unit cost is ~$0.012/G", () => {
    expect(sesameResult.isConvertible).toBe(true);
    if (sesameResult.isConvertible) {
      expect(sesameResult.standardUnitCost).toBeCloseTo(0.012, 4);
    }
  });

  it("line cost: 500G flour = ~$0.96", () => {
    if (!flourResult.isConvertible) return;
    const cost = calculateRecipeItemCost(500, flourResult.standardUnitCost);
    expect(cost).toBeCloseTo(0.96, 4);
  });

  it("line cost: 50ML cream cheese = ~$0.3625", () => {
    if (!creamResult.isConvertible) return;
    const cost = calculateRecipeItemCost(50, creamResult.standardUnitCost);
    expect(cost).toBeCloseTo(0.3625, 4);
  });

  it("line cost: 5G sesame seeds = ~$0.06", () => {
    if (!sesameResult.isConvertible) return;
    const cost = calculateRecipeItemCost(5, sesameResult.standardUnitCost);
    expect(cost).toBeCloseTo(0.06, 4);
  });

  it("total recipe cost sums all line costs", () => {
    if (
      !flourResult.isConvertible ||
      !creamResult.isConvertible ||
      !sesameResult.isConvertible
    ) {
      return;
    }
    const flourLine = calculateRecipeItemCost(500, flourResult.standardUnitCost)!;
    const creamLine = calculateRecipeItemCost(50, creamResult.standardUnitCost)!;
    const sesameLine = calculateRecipeItemCost(5, sesameResult.standardUnitCost)!;
    const total = calculateRecipeTotalCost([flourLine, creamLine, sesameLine]);
    // 0.96 + 0.3625 + 0.06 = 1.3825
    expect(total).toBeCloseTo(1.3825, 4);
  });
});

// ─── Business rule: unit must match ingredient.baseUnit ───────────────────────

describe("Unit mismatch rejection", () => {
  it("KG purchase → G base unit: consistent conversion (no mismatch)", () => {
    // In the recipe layer, unit == ingredient.baseUnit is enforced.
    // Here we verify the costing still works when baseUnit is G and recipe unit is G.
    const result = calculateStandardUnitCost(48.0, 25, UnitType.KG, UnitType.G);
    expect(result.isConvertible).toBe(true);
  });

  it("cross-group mismatch (KG → ML) blocks cost calculation", () => {
    const result = calculateStandardUnitCost(10.0, 1, UnitType.KG, UnitType.ML);
    expect(result.isConvertible).toBe(false);
    if (!result.isConvertible) {
      expect(result.errorCode).toBe("CROSS_GROUP");
    }
  });
});

// ─── Duplicate detection (pure logic) ────────────────────────────────────────

describe("Duplicate ingredient detection", () => {
  const existingIngredientIds = ["ing_flour", "ing_cream", "ing_sesame"];

  it("detects a duplicate when ingredient is already in the recipe", () => {
    const isDuplicate = existingIngredientIds.includes("ing_flour");
    expect(isDuplicate).toBe(true);
  });

  it("does not flag a new ingredient as a duplicate", () => {
    const isDuplicate = existingIngredientIds.includes("ing_salt");
    expect(isDuplicate).toBe(false);
  });
});

// ─── Phase 4: Yield-adjusted costing ─────────────────────────────────────────

describe("calculateEffectiveQuantity", () => {
  it("yield=100 returns the same quantity (no loss)", () => {
    expect(calculateEffectiveQuantity(10, 100)).toBe(10);
  });

  it("yield=85 means 10 G needs 10/0.85 ≈ 11.765 G to get 10 G usable", () => {
    expect(calculateEffectiveQuantity(10, 85)).toBeCloseTo(11.7647, 3);
  });

  it("yield=50 doubles effective quantity", () => {
    expect(calculateEffectiveQuantity(100, 50)).toBeCloseTo(200, 5);
  });

  it("yield=98 is close to 1:1 for cream cheese", () => {
    expect(calculateEffectiveQuantity(35, 98)).toBeCloseTo(35.714, 2);
  });
});

describe("calculateAdjustedLineCost", () => {
  it("yield=100 adjusted cost equals direct cost", () => {
    const directCost = calculateRecipeItemCost(10, 0.004);
    const adjustedCost = calculateAdjustedLineCost(10, 100, 0.004);
    expect(adjustedCost).toBeCloseTo(directCost!, 6);
    expect(adjustedCost).toBeCloseTo(0.04, 5);
  });

  it("returns null when standardUnitCost is null", () => {
    expect(calculateAdjustedLineCost(10, 85, null)).toBeNull();
  });

  it("onion: 10 G, yield 85%, cost 0.004/G → adjusted ~$0.04706", () => {
    // effectiveQty = 10 / 0.85 ≈ 11.7647
    // adjustedCost = 11.7647 × 0.004 ≈ 0.04706
    const adjusted = calculateAdjustedLineCost(10, 85, 0.004);
    expect(adjusted).toBeCloseTo(0.04706, 4);
  });

  it("cream cheese: 35 G, yield 98%, cost/G from 2 L @ $14.50", () => {
    // std cost: $14.50 / 2000 mL = $0.00725/mL... but base is G, so let's use G
    // If cream cheese 500g @ $5.00: stdCost = 5/500 = 0.01/G
    // effectiveQty = 35 / 0.98 ≈ 35.714
    // adjustedCost = 35.714 × 0.01 ≈ 0.35714
    const adjusted = calculateAdjustedLineCost(35, 98, 0.01);
    expect(adjusted).toBeCloseTo(0.35714, 4);
  });
});

describe("Phase 4: adjusted total cost calculation", () => {
  // Onion: 10 G, yield 85%, cost $0.004/G
  // Cream Cheese: 35 G, yield 98%, cost $0.01/G
  // Paper Bag: 1 EA, yield 100%, cost $0.15/EA

  const onionDirectCost = calculateRecipeItemCost(10, 0.004); // 0.04
  const onionAdjusted = calculateAdjustedLineCost(10, 85, 0.004); // ≈0.04706

  const creamDirectCost = calculateRecipeItemCost(35, 0.01); // 0.35
  const creamAdjusted = calculateAdjustedLineCost(35, 98, 0.01); // ≈0.35714

  const bagDirectCost = calculateRecipeItemCost(1, 0.15); // 0.15
  const bagAdjusted = calculateAdjustedLineCost(1, 100, 0.15); // 0.15

  it("paper bag (yield=100): direct cost equals adjusted cost", () => {
    expect(bagAdjusted).toBeCloseTo(bagDirectCost!, 6);
    expect(bagAdjusted).toBeCloseTo(0.15, 5);
  });

  it("direct total cost sums all direct line costs", () => {
    const total = calculateRecipeTotalCost([onionDirectCost, creamDirectCost, bagDirectCost]);
    // 0.04 + 0.35 + 0.15 = 0.54
    expect(total).toBeCloseTo(0.54, 5);
  });

  it("adjusted total cost is higher than direct when yield < 100", () => {
    const directTotal = calculateRecipeTotalCost([onionDirectCost, creamDirectCost, bagDirectCost]);
    const adjustedTotal = calculateRecipeTotalCost([onionAdjusted, creamAdjusted, bagAdjusted]);
    expect(adjustedTotal).toBeGreaterThan(directTotal!);
  });

  it("adjusted total ≈ 0.04706 + 0.35714 + 0.15 ≈ 0.5542", () => {
    const adjustedTotal = calculateRecipeTotalCost([onionAdjusted, creamAdjusted, bagAdjusted]);
    expect(adjustedTotal).toBeCloseTo(0.5542, 3);
  });

  it("returns null from total if any line cost is null", () => {
    const total = calculateRecipeTotalCost([onionAdjusted, null, bagAdjusted]);
    expect(total).toBeNull();
  });
});

describe("yieldPercent validation rules (business rules)", () => {
  it("yield=100 is valid (no loss)", () => {
    // 100 is the default — must be accepted
    const effective = calculateEffectiveQuantity(100, 100);
    expect(effective).toBe(100);
  });

  it("yield=85 is valid (15% loss)", () => {
    const effective = calculateEffectiveQuantity(100, 85);
    expect(effective).toBeCloseTo(117.647, 2);
  });

  it("yield must be > 0 — near zero yields very high effective quantity", () => {
    // We do not test 0 here as that would divide by zero.
    // Very small yield (e.g., 0.01) is technically valid per schema but unusual.
    const effective = calculateEffectiveQuantity(100, 1);
    expect(effective).toBeCloseTo(10000, 0);
  });

  it("yield=100 packaging item: direct cost === adjusted cost", () => {
    const directCost = calculateRecipeItemCost(1, 0.25); // paper bag
    const adjustedCost = calculateAdjustedLineCost(1, 100, 0.25);
    expect(directCost).toBeCloseTo(adjustedCost!, 6);
  });
});

// ─── Phase 8: Batch output and component product costing ──────────────────────

describe("calculateCostPerOutputUnit — batch recipe per-unit cost", () => {
  it("plain bagel batch: $18.00 / 24 bagels = $0.75/ea", () => {
    const perUnit = calculateCostPerOutputUnit(18.0, 24);
    expect(perUnit).toBeCloseTo(0.75, 6);
  });

  it("returns null when batchTotalCost is null", () => {
    expect(calculateCostPerOutputUnit(null, 24)).toBeNull();
  });

  it("returns null when outputQuantity is 0", () => {
    expect(calculateCostPerOutputUnit(18.0, 0)).toBeNull();
  });

  it("returns null when outputQuantity is negative", () => {
    expect(calculateCostPerOutputUnit(18.0, -1)).toBeNull();
  });

  it("returns the cost itself for a single-unit batch", () => {
    const perUnit = calculateCostPerOutputUnit(5.5, 1);
    expect(perUnit).toBeCloseTo(5.5, 6);
  });

  it("handles fractional outputQuantity", () => {
    // $10.00 / 2.5 = $4.00/unit
    const perUnit = calculateCostPerOutputUnit(10.0, 2.5);
    expect(perUnit).toBeCloseTo(4.0, 6);
  });
});

describe("calculateComponentProductLineCost — product-as-component costing", () => {
  it("2 bagels × $0.75/bagel = $1.50", () => {
    const cost = calculateComponentProductLineCost(2, 0.75);
    expect(cost).toBeCloseTo(1.5, 5);
  });

  it("returns null when componentUnitCost is null", () => {
    expect(calculateComponentProductLineCost(2, null)).toBeNull();
  });

  it("returns 0 for zero quantity", () => {
    expect(calculateComponentProductLineCost(0, 0.75)).toBe(0);
  });

  it("handles fractional quantities", () => {
    // 0.5 × $3.20 = $1.60
    const cost = calculateComponentProductLineCost(0.5, 3.2);
    expect(cost).toBeCloseTo(1.6, 5);
  });
});

describe("Batch costing integration — plain bagel batch recipe", () => {
  // Scenario:
  // Plain Bagel batch recipe produces 24 EA
  // Ingredients:
  //   - High Gluten Flour: 1000 G × $0.00192/G = $1.92
  //   - Water: 600 ML × $0.0001/ML = $0.06
  //   - Salt: 20 G × $0.002/G = $0.04
  //   - Yeast: 10 G × $0.05/G = $0.50
  // Batch total = $2.52
  // But with yield adjustments (say flour 95%, others 100%):
  //   - Flour adjusted: 1000/0.95 × $0.00192 ≈ $2.021
  // Adjusted batch total ≈ $2.621
  // Per-unit cost ≈ $2.621 / 24 ≈ $0.1092

  const flourLineCost = calculateRecipeItemCost(1000, 0.00192); // $1.92
  const waterLineCost = calculateRecipeItemCost(600, 0.0001);   // $0.06
  const saltLineCost  = calculateRecipeItemCost(20, 0.002);      // $0.04
  const yeastLineCost = calculateRecipeItemCost(10, 0.05);       // $0.50

  const flourAdjusted = calculateAdjustedLineCost(1000, 95, 0.00192); // 1000/0.95 × 0.00192 ≈ 2.021
  const waterAdjusted = calculateAdjustedLineCost(600, 100, 0.0001);
  const saltAdjusted  = calculateAdjustedLineCost(20, 100, 0.002);
  const yeastAdjusted = calculateAdjustedLineCost(10, 100, 0.05);

  it("direct batch total = $2.52", () => {
    const total = calculateRecipeTotalCost([flourLineCost, waterLineCost, saltLineCost, yeastLineCost]);
    expect(total).toBeCloseTo(2.52, 4);
  });

  it("direct cost per bagel = $2.52 / 24 ≈ $0.105", () => {
    const batchTotal = calculateRecipeTotalCost([flourLineCost, waterLineCost, saltLineCost, yeastLineCost]);
    const perUnit = calculateCostPerOutputUnit(batchTotal, 24);
    expect(perUnit).toBeCloseTo(0.105, 4);
  });

  it("adjusted batch total > direct batch total when yield < 100", () => {
    const directTotal = calculateRecipeTotalCost([flourLineCost, waterLineCost, saltLineCost, yeastLineCost]);
    const adjustedTotal = calculateRecipeTotalCost([flourAdjusted, waterAdjusted, saltAdjusted, yeastAdjusted]);
    expect(adjustedTotal!).toBeGreaterThan(directTotal!);
  });

  it("adjusted cost per bagel is higher than direct cost per bagel", () => {
    const directBatch = calculateRecipeTotalCost([flourLineCost, waterLineCost, saltLineCost, yeastLineCost]);
    const adjustedBatch = calculateRecipeTotalCost([flourAdjusted, waterAdjusted, saltAdjusted, yeastAdjusted]);
    const directPerUnit = calculateCostPerOutputUnit(directBatch, 24);
    const adjustedPerUnit = calculateCostPerOutputUnit(adjustedBatch, 24);
    expect(adjustedPerUnit!).toBeGreaterThan(directPerUnit!);
  });

  it("null batch total gives null per-unit cost", () => {
    // Simulate ingredient with no cost
    const incompleteCosts: (number | null)[] = [flourLineCost, null, saltLineCost, yeastLineCost];
    const batchTotal = calculateRecipeTotalCost(incompleteCosts);
    const perUnit = calculateCostPerOutputUnit(batchTotal, 24);
    expect(batchTotal).toBeNull();
    expect(perUnit).toBeNull();
  });
});

describe("Component product cost roll-up — sandwich uses plain bagel", () => {
  // Plain Bagel: per-unit cost $0.75 (from its own batch recipe)
  // BLT Bagel Sandwich recipe:
  //   - 1 EA Plain Bagel × $0.75 = $0.75
  //   - 30 G Lettuce × $0.005/G = $0.15
  //   - 50 G Bacon × $0.02/G = $1.00
  // Batch total = $1.90, output 1 EA
  // Cost per sandwich = $1.90

  const bagelLineCost = calculateComponentProductLineCost(1, 0.75); // $0.75
  const lettuceLineCost = calculateRecipeItemCost(30, 0.005);        // $0.15
  const baconLineCost = calculateRecipeItemCost(50, 0.02);           // $1.00

  it("bagel component line cost = $0.75", () => {
    expect(bagelLineCost).toBeCloseTo(0.75, 5);
  });

  it("sandwich batch total = $1.90", () => {
    const total = calculateRecipeTotalCost([bagelLineCost, lettuceLineCost, baconLineCost]);
    expect(total).toBeCloseTo(1.9, 4);
  });

  it("cost per sandwich = $1.90 (output 1 EA)", () => {
    const total = calculateRecipeTotalCost([bagelLineCost, lettuceLineCost, baconLineCost]);
    const perUnit = calculateCostPerOutputUnit(total, 1);
    expect(perUnit).toBeCloseTo(1.9, 4);
  });

  it("unavailable bagel cost makes sandwich total null", () => {
    const unavailableBagel = calculateComponentProductLineCost(1, null);
    const total = calculateRecipeTotalCost([unavailableBagel, lettuceLineCost, baconLineCost]);
    expect(total).toBeNull();
  });
});

describe("recipeItemSchema validation — source type rules", () => {

  it("INGREDIENT source: ingredientId required, componentProductId null", () => {
    const result = recipeItemSchema.safeParse({
      sourceType: "INGREDIENT",
      ingredientId: "ing-123",
      componentProductId: null,
      quantity: 100,
      unit: "G",
    });
    expect(result.success).toBe(true);
  });

  it("INGREDIENT source: fails when ingredientId is missing", () => {
    const result = recipeItemSchema.safeParse({
      sourceType: "INGREDIENT",
      ingredientId: null,
      componentProductId: null,
      quantity: 100,
      unit: "G",
    });
    expect(result.success).toBe(false);
  });

  it("INGREDIENT source: fails when componentProductId is set", () => {
    const result = recipeItemSchema.safeParse({
      sourceType: "INGREDIENT",
      ingredientId: "ing-123",
      componentProductId: "prod-456",
      quantity: 100,
      unit: "G",
    });
    expect(result.success).toBe(false);
  });

  it("PRODUCT source: componentProductId required, ingredientId null", () => {
    const result = recipeItemSchema.safeParse({
      sourceType: "PRODUCT",
      componentProductId: "prod-456",
      ingredientId: null,
      quantity: 1,
      unit: "EA",
    });
    expect(result.success).toBe(true);
  });

  it("PRODUCT source: fails when componentProductId is missing", () => {
    const result = recipeItemSchema.safeParse({
      sourceType: "PRODUCT",
      componentProductId: null,
      ingredientId: null,
      quantity: 1,
      unit: "EA",
    });
    expect(result.success).toBe(false);
  });

  it("PRODUCT source: fails when ingredientId is set", () => {
    const result = recipeItemSchema.safeParse({
      sourceType: "PRODUCT",
      componentProductId: "prod-456",
      ingredientId: "ing-123",
      quantity: 1,
      unit: "EA",
    });
    expect(result.success).toBe(false);
  });

  it("fails when quantity is 0", () => {
    const result = recipeItemSchema.safeParse({
      sourceType: "INGREDIENT",
      ingredientId: "ing-123",
      quantity: 0,
      unit: "G",
    });
    expect(result.success).toBe(false);
  });

  it("fails when quantity is negative", () => {
    const result = recipeItemSchema.safeParse({
      sourceType: "INGREDIENT",
      ingredientId: "ing-123",
      quantity: -5,
      unit: "G",
    });
    expect(result.success).toBe(false);
  });
});

describe("recipeSchema — batch output validation", () => {

  it("accepts valid batch output", () => {
    const result = recipeSchema.safeParse({
      name: "Plain Bagel Recipe",
      outputQuantity: 24,
      outputUnit: "EA",
    });
    expect(result.success).toBe(true);
  });

  it("defaults outputQuantity to 1 when not provided", () => {
    const result = recipeSchema.safeParse({
      name: "Plain Bagel Recipe",
      outputUnit: "EA",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outputQuantity).toBe(1);
    }
  });

  it("fails when outputQuantity is 0", () => {
    const result = recipeSchema.safeParse({
      name: "Plain Bagel Recipe",
      outputQuantity: 0,
      outputUnit: "EA",
    });
    expect(result.success).toBe(false);
  });

  it("fails when outputQuantity is negative", () => {
    const result = recipeSchema.safeParse({
      name: "Plain Bagel Recipe",
      outputQuantity: -1,
      outputUnit: "EA",
    });
    expect(result.success).toBe(false);
  });

  it("fails when name is empty", () => {
    const result = recipeSchema.safeParse({
      name: "",
      outputQuantity: 24,
      outputUnit: "EA",
    });
    expect(result.success).toBe(false);
  });
});
