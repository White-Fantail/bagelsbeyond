import { describe, it, expect } from "vitest";
import { PricingTargetType, RecommendedPriceRounding } from "@/app/generated/prisma/enums";
import {
  computeRecipeItemImpact,
  computeProductImpact,
  sortByAbsoluteCostDelta,
} from "@/lib/costing/analysis/menu-impact";
import type { EffectivePricingTarget } from "@/lib/costing/pricing";

// ─── computeRecipeItemImpact ──────────────────────────────────────────────────

describe("computeRecipeItemImpact — basic", () => {
  it("calculates line costs correctly with yield 100%", () => {
    // 500 g × $0.00192/g = $0.96
    const result = computeRecipeItemImpact({
      quantity: 500,
      yieldPercent: 100,
      previousStandardUnitCost: 0.00192,
      currentStandardUnitCost: 0.0024,
    });
    expect(result.previousLineCost).toBeCloseTo(0.96, 4);
    expect(result.currentLineCost).toBeCloseTo(1.2, 4);
    expect(result.costDelta).toBeCloseTo(0.24, 4);
  });

  it("applies yield adjustment", () => {
    // 500g with 80% yield → effective qty = 500 / 0.8 = 625g
    const result = computeRecipeItemImpact({
      quantity: 500,
      yieldPercent: 80,
      previousStandardUnitCost: 0.00192,
      currentStandardUnitCost: 0.0024,
    });
    expect(result.previousLineCost).toBeCloseTo(625 * 0.00192, 4); // 1.2
    expect(result.currentLineCost).toBeCloseTo(625 * 0.0024, 4);  // 1.5
  });

  it("returns null line costs when standardUnitCost is null", () => {
    const result = computeRecipeItemImpact({
      quantity: 500,
      yieldPercent: 100,
      previousStandardUnitCost: null,
      currentStandardUnitCost: 0.0024,
    });
    expect(result.previousLineCost).toBeNull();
    expect(result.costDelta).toBeNull();
  });

  it("returns null costDelta when either cost is null", () => {
    const result = computeRecipeItemImpact({
      quantity: 500,
      yieldPercent: 100,
      previousStandardUnitCost: 0.00192,
      currentStandardUnitCost: null,
    });
    expect(result.costDelta).toBeNull();
  });
});

// ─── computeProductImpact ─────────────────────────────────────────────────────

const marginTarget: EffectivePricingTarget = {
  targetType: PricingTargetType.MARGIN_PERCENT,
  targetPercent: 60,
  isOverride: false,
};

const costTarget: EffectivePricingTarget = {
  targetType: PricingTargetType.COST_PERCENT,
  targetPercent: 30,
  isOverride: false,
};

describe("computeProductImpact — cost delta", () => {
  it("computes cost delta and contribution delta", () => {
    const row = computeProductImpact(
      "prod-1",
      "Plain Bagel",
      /* sellingPrice */ 5.0,
      /* ingredientQuantity */ 200,
      /* yieldPercent */ 100,
      /* previousStandardUnitCost */ 0.001,
      /* currentStandardUnitCost */ 0.002,
      /* previousBatchAdjustedCost */ 2.0,
      /* currentBatchAdjustedCost */ 2.2,
      /* outputQuantity */ 12,
      marginTarget
    );

    expect(row.costDelta).toBeCloseTo(0.2, 4);
    expect(row.contributionDelta).toBeCloseTo(0.2, 4); // 200 * (0.002 - 0.001)
    expect(row.previousCostPerUnit).toBeCloseTo(2.0 / 12, 4);
    expect(row.currentCostPerUnit).toBeCloseTo(2.2 / 12, 4);
  });
});

describe("computeProductImpact — margin effect", () => {
  it("calculates margin effect correctly with selling price", () => {
    // Previous: cost/unit = $1.00, selling = $5.00 → margin = 80%
    // Current: cost/unit = $1.50, selling = $5.00 → margin = 70%
    const row = computeProductImpact(
      "prod-1", "Bagel", 5.0,
      100, 100,
      0.01, 0.015,
      /* prevBatch */ 1.0, /* currBatch */ 1.5,
      /* output */ 1,
      null
    );
    expect(row.marginEffect).toBeCloseTo(-10, 1); // 70% - 80% = -10pp
  });

  it("returns null margin effect when no selling price", () => {
    const row = computeProductImpact("prod-1", "Bagel", null, 100, 100, 0.01, 0.015, 1.0, 1.5, 1, null);
    expect(row.marginEffect).toBeNull();
  });
});

describe("computeProductImpact — recommended price delta", () => {
  it("calculates recommended price delta with MARGIN_PERCENT target", () => {
    // 60% margin: recPrice = cost / (1 - 0.6) = cost / 0.4
    // prev cost/unit = 1.0 → rec = 2.5
    // curr cost/unit = 1.2 → rec = 3.0
    const row = computeProductImpact(
      "prod-1", "Bagel", 4.0,
      100, 100,
      0.01, 0.012,
      1.0, 1.2,
      1,
      marginTarget
    );
    expect(row.previousRecommendedPrice).toBeCloseTo(2.5, 2);
    expect(row.currentRecommendedPrice).toBeCloseTo(3.0, 2);
    expect(row.recommendedPriceDelta).toBeCloseTo(0.5, 2);
  });

  it("calculates recommended price delta with COST_PERCENT target", () => {
    // 30% cost: recPrice = cost / 0.3
    // prev = 1.0 / 0.3 ≈ 3.33
    // curr = 1.5 / 0.3 = 5.0
    const row = computeProductImpact(
      "prod-1", "Bagel", 4.0,
      100, 100,
      0.01, 0.015,
      1.0, 1.5,
      1,
      costTarget
    );
    expect(row.previousRecommendedPrice).toBeCloseTo(3.333, 2);
    expect(row.currentRecommendedPrice).toBeCloseTo(5.0, 2);
    expect(row.recommendedPriceDelta).toBeCloseTo(1.667, 2);
  });

  it("returns null recommended price delta when no target", () => {
    const row = computeProductImpact("prod-1", "Bagel", 4.0, 100, 100, 0.01, 0.015, 1.0, 1.5, 1, null);
    expect(row.recommendedPriceDelta).toBeNull();
  });
});

// ─── sortByAbsoluteCostDelta ──────────────────────────────────────────────────

describe("sortByAbsoluteCostDelta", () => {
  it("sorts by absolute cost delta descending", () => {
    const makeRow = (productId: string, costDelta: number | null) =>
      computeProductImpact(productId, productId, null, 1, 100, null, null, null, null, 1, null)
      // Override costDelta manually
      ;

    const rows = [
      { ...computeProductImpact("a", "A", null, 1, 100, null, null, null, null, 1, null), costDelta: 0.5 },
      { ...computeProductImpact("b", "B", null, 1, 100, null, null, null, null, 1, null), costDelta: -2.0 },
      { ...computeProductImpact("c", "C", null, 1, 100, null, null, null, null, 1, null), costDelta: 0.1 },
    ];

    const sorted = sortByAbsoluteCostDelta(rows);
    expect(sorted[0].productId).toBe("b"); // |−2.0| = 2.0
    expect(sorted[1].productId).toBe("a"); // |0.5|
    expect(sorted[2].productId).toBe("c"); // |0.1|
  });
});
