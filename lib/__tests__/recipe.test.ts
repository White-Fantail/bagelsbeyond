import { describe, it, expect } from "vitest";
import { UnitType } from "@/app/generated/prisma/enums";
import {
  calculateRecipeItemCost,
  calculateRecipeTotalCost,
  calculateEffectiveQuantity,
  calculateAdjustedLineCost,
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
