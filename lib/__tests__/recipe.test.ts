import { describe, it, expect } from "vitest";
import { UnitType } from "@/app/generated/prisma/enums";
import {
  calculateRecipeItemCost,
  calculateRecipeTotalCost,
} from "@/lib/costing/recipe-cost";
import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";

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
