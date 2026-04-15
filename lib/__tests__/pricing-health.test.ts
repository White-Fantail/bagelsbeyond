import { describe, it, expect } from "vitest";
import { PricingTargetType } from "@/app/generated/prisma/enums";
import {
  filterBelowTarget,
  filterAtRisk,
  sortByLargestPriceGap,
  sortByHighestAdjustedCost,
  buildPricingHealthSummary,
  extractTargetPercents,
  computePriceGapPct,
  type ProductHealthRow,
} from "@/lib/costing/analysis/pricing-health";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<ProductHealthRow> = {}): ProductHealthRow {
  return {
    productId: "prod-1",
    productName: "Plain Bagel",
    sellingPrice: 5.0,
    adjustedCostPerUnit: 1.5,
    actualCostPercent: 30,
    actualMarginPercent: 70,
    targetMarginPercent: 60,
    targetCostPercent: null,
    effectiveTarget: {
      targetType: PricingTargetType.MARGIN_PERCENT,
      targetPercent: 60,
      isOverride: false,
    },
    recommendedPrice: 3.75,
    priceGap: 1.25, // 5.0 - 3.75
    pricingStatus: "ABOVE_TARGET",
    priceGapPct: (1.25 / 3.75) * 100,
    ...overrides,
  };
}

// ─── extractTargetPercents ────────────────────────────────────────────────────

describe("extractTargetPercents", () => {
  it("returns targetMarginPercent for MARGIN_PERCENT type", () => {
    const result = extractTargetPercents({
      targetType: PricingTargetType.MARGIN_PERCENT,
      targetPercent: 60,
      isOverride: false,
    });
    expect(result.targetMarginPercent).toBe(60);
    expect(result.targetCostPercent).toBeNull();
  });

  it("returns targetCostPercent for COST_PERCENT type", () => {
    const result = extractTargetPercents({
      targetType: PricingTargetType.COST_PERCENT,
      targetPercent: 30,
      isOverride: false,
    });
    expect(result.targetCostPercent).toBe(30);
    expect(result.targetMarginPercent).toBeNull();
  });

  it("returns null values for null target", () => {
    const result = extractTargetPercents(null);
    expect(result.targetMarginPercent).toBeNull();
    expect(result.targetCostPercent).toBeNull();
  });
});

// ─── computePriceGapPct ───────────────────────────────────────────────────────

describe("computePriceGapPct", () => {
  it("computes gap percent correctly", () => {
    // priceGap = 1.25, recommendedPrice = 3.75 → 33.33%
    expect(computePriceGapPct(1.25, 3.75)).toBeCloseTo(33.33, 1);
  });

  it("returns null when priceGap is null", () => {
    expect(computePriceGapPct(null, 3.75)).toBeNull();
  });

  it("returns null when recommendedPrice is null or zero", () => {
    expect(computePriceGapPct(1.25, null)).toBeNull();
    expect(computePriceGapPct(1.25, 0)).toBeNull();
  });
});

// ─── filterBelowTarget ────────────────────────────────────────────────────────

describe("filterBelowTarget", () => {
  it("returns only BELOW_TARGET products", () => {
    const rows: ProductHealthRow[] = [
      makeRow({ productId: "a", pricingStatus: "BELOW_TARGET" }),
      makeRow({ productId: "b", pricingStatus: "ON_TARGET" }),
      makeRow({ productId: "c", pricingStatus: "ABOVE_TARGET" }),
      makeRow({ productId: "d", pricingStatus: "NO_SELLING_PRICE" }),
    ];
    const result = filterBelowTarget(rows);
    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe("a");
  });

  it("returns empty array when no products are below target", () => {
    const rows: ProductHealthRow[] = [
      makeRow({ pricingStatus: "ON_TARGET" }),
      makeRow({ pricingStatus: "ABOVE_TARGET" }),
    ];
    expect(filterBelowTarget(rows)).toHaveLength(0);
  });
});

// ─── filterAtRisk ─────────────────────────────────────────────────────────────

describe("filterAtRisk", () => {
  it("includes BELOW_TARGET and ON_TARGET", () => {
    const rows: ProductHealthRow[] = [
      makeRow({ productId: "a", pricingStatus: "BELOW_TARGET" }),
      makeRow({ productId: "b", pricingStatus: "ON_TARGET" }),
      makeRow({ productId: "c", pricingStatus: "ABOVE_TARGET" }),
    ];
    const result = filterAtRisk(rows);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.productId)).toContain("a");
    expect(result.map((r) => r.productId)).toContain("b");
  });
});

// ─── sortByLargestPriceGap ────────────────────────────────────────────────────

describe("sortByLargestPriceGap", () => {
  it("sorts most negative gap first (furthest below recommended)", () => {
    const rows: ProductHealthRow[] = [
      makeRow({ productId: "a", priceGap: -3.0, pricingStatus: "BELOW_TARGET" }),
      makeRow({ productId: "b", priceGap: -1.0, pricingStatus: "BELOW_TARGET" }),
      makeRow({ productId: "c", priceGap: 1.5, pricingStatus: "ABOVE_TARGET" }),
    ];
    const sorted = sortByLargestPriceGap(rows);
    expect(sorted[0].productId).toBe("a"); // -3.0 is most negative
    expect(sorted[1].productId).toBe("b");
  });
});

// ─── sortByHighestAdjustedCost ────────────────────────────────────────────────

describe("sortByHighestAdjustedCost", () => {
  it("sorts highest adjusted cost per unit first", () => {
    const rows: ProductHealthRow[] = [
      makeRow({ productId: "a", adjustedCostPerUnit: 1.0 }),
      makeRow({ productId: "b", adjustedCostPerUnit: 3.5 }),
      makeRow({ productId: "c", adjustedCostPerUnit: 2.0 }),
    ];
    const sorted = sortByHighestAdjustedCost(rows);
    expect(sorted[0].productId).toBe("b");
    expect(sorted[1].productId).toBe("c");
    expect(sorted[2].productId).toBe("a");
  });
});

// ─── buildPricingHealthSummary ────────────────────────────────────────────────

describe("buildPricingHealthSummary", () => {
  const rows: ProductHealthRow[] = [
    makeRow({ productId: "a", pricingStatus: "BELOW_TARGET" }),
    makeRow({ productId: "b", pricingStatus: "BELOW_TARGET" }),
    makeRow({ productId: "c", pricingStatus: "ON_TARGET" }),
    makeRow({ productId: "d", pricingStatus: "ABOVE_TARGET" }),
    makeRow({ productId: "e", pricingStatus: "NO_SELLING_PRICE" }),
    makeRow({ productId: "f", pricingStatus: "NO_RECIPE_COST", adjustedCostPerUnit: null }),
    makeRow({ productId: "g", pricingStatus: "NO_TARGET" }),
  ];

  it("counts statuses correctly", () => {
    const summary = buildPricingHealthSummary(rows);
    expect(summary.totalProducts).toBe(7);
    expect(summary.belowTargetCount).toBe(2);
    expect(summary.onTargetCount).toBe(1);
    expect(summary.aboveTargetCount).toBe(1);
    expect(summary.noSellingPriceCount).toBe(1);
    expect(summary.noRecipeCostCount).toBe(1);
    expect(summary.noTargetCount).toBe(1);
  });

  it("populates belowTargetProducts", () => {
    const summary = buildPricingHealthSummary(rows);
    expect(summary.belowTargetProducts).toHaveLength(2);
  });
});
