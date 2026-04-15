import { describe, it, expect } from "vitest";
import { PricingTargetType, RecommendedPriceRounding } from "@/app/generated/prisma/enums";
import {
  getEffectivePricingTarget,
  calculateActualCostPercent,
  calculateActualMarginPercent,
  calculateRecommendedPrice,
  roundRecommendedPrice,
  calculatePricingStatus,
  buildProductPricingSummary,
} from "../costing/pricing";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const globalDefault = {
  defaultPricingTargetType: PricingTargetType.COST_PERCENT,
  defaultPricingTargetPercent: "30.00",
  defaultPriceRounding: RecommendedPriceRounding.NONE,
};

const noOverrideProduct = {
  pricingTargetType: null,
  pricingTargetPercent: null,
};

const costOverrideProduct = {
  pricingTargetType: PricingTargetType.COST_PERCENT,
  pricingTargetPercent: "25.00",
};

const marginOverrideProduct = {
  pricingTargetType: PricingTargetType.MARGIN_PERCENT,
  pricingTargetPercent: "60.00",
};

// ─── getEffectivePricingTarget ────────────────────────────────────────────────

describe("getEffectivePricingTarget — global default fallback", () => {
  it("uses global default when product has no override", () => {
    const result = getEffectivePricingTarget(noOverrideProduct, globalDefault);
    expect(result).not.toBeNull();
    expect(result!.targetType).toBe(PricingTargetType.COST_PERCENT);
    expect(result!.targetPercent).toBe(30);
    expect(result!.isOverride).toBe(false);
  });

  it("returns null when no global settings and no product override", () => {
    const result = getEffectivePricingTarget(noOverrideProduct, null);
    expect(result).toBeNull();
  });
});

describe("getEffectivePricingTarget — product override wins", () => {
  it("uses product cost percent override", () => {
    const result = getEffectivePricingTarget(costOverrideProduct, globalDefault);
    expect(result!.targetType).toBe(PricingTargetType.COST_PERCENT);
    expect(result!.targetPercent).toBe(25);
    expect(result!.isOverride).toBe(true);
  });

  it("uses product margin percent override", () => {
    const result = getEffectivePricingTarget(marginOverrideProduct, globalDefault);
    expect(result!.targetType).toBe(PricingTargetType.MARGIN_PERCENT);
    expect(result!.targetPercent).toBe(60);
    expect(result!.isOverride).toBe(true);
  });

  it("falls back to global when product percent is out of range (0)", () => {
    const badProduct = { pricingTargetType: PricingTargetType.COST_PERCENT, pricingTargetPercent: "0" };
    const result = getEffectivePricingTarget(badProduct, globalDefault);
    expect(result!.isOverride).toBe(false);
  });

  it("falls back to global when product percent is out of range (100)", () => {
    const badProduct = { pricingTargetType: PricingTargetType.COST_PERCENT, pricingTargetPercent: "100" };
    const result = getEffectivePricingTarget(badProduct, globalDefault);
    expect(result!.isOverride).toBe(false);
  });
});

// ─── calculateActualCostPercent ───────────────────────────────────────────────

describe("calculateActualCostPercent", () => {
  it("calculates correctly: $1.50 cost / $5.00 price = 30%", () => {
    expect(calculateActualCostPercent(1.5, 5.0)).toBeCloseTo(30, 5);
  });

  it("returns null when sellingPrice is null", () => {
    expect(calculateActualCostPercent(1.5, null)).toBeNull();
  });

  it("returns null when sellingPrice is 0", () => {
    expect(calculateActualCostPercent(1.5, 0)).toBeNull();
  });

  it("returns null when sellingPrice is negative", () => {
    expect(calculateActualCostPercent(1.5, -1)).toBeNull();
  });

  it("handles cost > price (cost percent > 100%)", () => {
    expect(calculateActualCostPercent(6, 5)).toBeCloseTo(120, 5);
  });
});

// ─── calculateActualMarginPercent ─────────────────────────────────────────────

describe("calculateActualMarginPercent", () => {
  it("calculates correctly: ($5 - $1.50) / $5 = 70%", () => {
    expect(calculateActualMarginPercent(1.5, 5.0)).toBeCloseTo(70, 5);
  });

  it("returns null when sellingPrice is null", () => {
    expect(calculateActualMarginPercent(1.5, null)).toBeNull();
  });

  it("returns null when sellingPrice is 0", () => {
    expect(calculateActualMarginPercent(1.5, 0)).toBeNull();
  });

  it("returns negative margin when cost exceeds selling price", () => {
    expect(calculateActualMarginPercent(6, 5)).toBeCloseTo(-20, 5);
  });
});

// ─── calculateRecommendedPrice — COST_PERCENT ─────────────────────────────────

describe("calculateRecommendedPrice — COST_PERCENT target", () => {
  const target = { targetType: PricingTargetType.COST_PERCENT, targetPercent: 30, isOverride: false };

  it("$1.50 cost at 30% → recommended $5.00", () => {
    expect(calculateRecommendedPrice(1.5, target)).toBeCloseTo(5.0, 5);
  });

  it("$2.00 cost at 25% → recommended $8.00", () => {
    const t = { ...target, targetPercent: 25 };
    expect(calculateRecommendedPrice(2.0, t)).toBeCloseTo(8.0, 5);
  });

  it("returns null when target is null", () => {
    expect(calculateRecommendedPrice(1.5, null)).toBeNull();
  });

  it("returns null when targetPercent is 0", () => {
    expect(calculateRecommendedPrice(1.5, { ...target, targetPercent: 0 })).toBeNull();
  });

  it("returns null when targetPercent is 100", () => {
    expect(calculateRecommendedPrice(1.5, { ...target, targetPercent: 100 })).toBeNull();
  });
});

// ─── calculateRecommendedPrice — MARGIN_PERCENT ───────────────────────────────

describe("calculateRecommendedPrice — MARGIN_PERCENT target", () => {
  const target = { targetType: PricingTargetType.MARGIN_PERCENT, targetPercent: 70, isOverride: false };

  it("$1.50 cost at 70% margin → recommended $5.00", () => {
    // price = 1.5 / (1 - 0.70) = 1.5 / 0.30 = 5.00
    expect(calculateRecommendedPrice(1.5, target)).toBeCloseTo(5.0, 5);
  });

  it("$2.00 cost at 60% margin → recommended $5.00", () => {
    // price = 2.0 / (1 - 0.60) = 2.0 / 0.40 = 5.00
    const t = { ...target, targetPercent: 60 };
    expect(calculateRecommendedPrice(2.0, t)).toBeCloseTo(5.0, 5);
  });

  it("$1.00 cost at 75% margin → recommended $4.00", () => {
    // price = 1.0 / (1 - 0.75) = 1.0 / 0.25 = 4.00
    const t = { ...target, targetPercent: 75 };
    expect(calculateRecommendedPrice(1.0, t)).toBeCloseTo(4.0, 5);
  });
});

// ─── roundRecommendedPrice ────────────────────────────────────────────────────

describe("roundRecommendedPrice — NONE", () => {
  it("returns price unchanged", () => {
    expect(roundRecommendedPrice(4.87, RecommendedPriceRounding.NONE)).toBe(4.87);
  });
});

describe("roundRecommendedPrice — NEAREST_0_10", () => {
  it("4.84 rounds to 4.80", () => {
    expect(roundRecommendedPrice(4.84, RecommendedPriceRounding.NEAREST_0_10)).toBeCloseTo(4.8, 5);
  });
  it("4.85 rounds to 4.90", () => {
    expect(roundRecommendedPrice(4.85, RecommendedPriceRounding.NEAREST_0_10)).toBeCloseTo(4.9, 5);
  });
  it("5.00 stays at 5.00", () => {
    expect(roundRecommendedPrice(5.0, RecommendedPriceRounding.NEAREST_0_10)).toBe(5.0);
  });
});

describe("roundRecommendedPrice — NEAREST_0_50", () => {
  it("4.74 rounds to 4.50", () => {
    expect(roundRecommendedPrice(4.74, RecommendedPriceRounding.NEAREST_0_50)).toBeCloseTo(4.5, 5);
  });
  it("4.75 rounds to 5.00", () => {
    expect(roundRecommendedPrice(4.75, RecommendedPriceRounding.NEAREST_0_50)).toBe(5.0);
  });
  it("5.00 stays at 5.00", () => {
    expect(roundRecommendedPrice(5.0, RecommendedPriceRounding.NEAREST_0_50)).toBe(5.0);
  });
});

describe("roundRecommendedPrice — NEAREST_1_00", () => {
  it("4.49 rounds to 4.00", () => {
    expect(roundRecommendedPrice(4.49, RecommendedPriceRounding.NEAREST_1_00)).toBe(4);
  });
  it("4.50 rounds to 5.00", () => {
    expect(roundRecommendedPrice(4.5, RecommendedPriceRounding.NEAREST_1_00)).toBe(5);
  });
  it("5.00 stays at 5.00", () => {
    expect(roundRecommendedPrice(5.0, RecommendedPriceRounding.NEAREST_1_00)).toBe(5);
  });
});

// ─── calculatePricingStatus ───────────────────────────────────────────────────

describe("calculatePricingStatus", () => {
  const target = { targetType: PricingTargetType.COST_PERCENT, targetPercent: 30, isOverride: false };

  it("returns NO_RECIPE_COST when adjustedCost is null", () => {
    expect(calculatePricingStatus(5.0, 5.0, null, target)).toBe("NO_RECIPE_COST");
  });

  it("returns NO_SELLING_PRICE when sellingPrice is null", () => {
    expect(calculatePricingStatus(5.0, null, 1.5, target)).toBe("NO_SELLING_PRICE");
  });

  it("returns NO_SELLING_PRICE when sellingPrice is 0", () => {
    expect(calculatePricingStatus(5.0, 0, 1.5, target)).toBe("NO_SELLING_PRICE");
  });

  it("returns NO_TARGET when target is null", () => {
    expect(calculatePricingStatus(null, 5.0, 1.5, null)).toBe("NO_TARGET");
  });

  it("returns NO_TARGET when recommendedPrice is null", () => {
    expect(calculatePricingStatus(null, 5.0, 1.5, target)).toBe("NO_TARGET");
  });

  it("returns ON_TARGET when selling price equals recommended price", () => {
    expect(calculatePricingStatus(5.0, 5.0, 1.5, target)).toBe("ON_TARGET");
  });

  it("returns ON_TARGET within 0.5% tolerance (high)", () => {
    expect(calculatePricingStatus(5.0, 5.024, 1.5, target)).toBe("ON_TARGET");
  });

  it("returns ABOVE_TARGET when selling price is above recommended", () => {
    expect(calculatePricingStatus(5.0, 6.0, 1.5, target)).toBe("ABOVE_TARGET");
  });

  it("returns BELOW_TARGET when selling price is below recommended", () => {
    expect(calculatePricingStatus(5.0, 4.0, 1.5, target)).toBe("BELOW_TARGET");
  });
});

// ─── buildProductPricingSummary ───────────────────────────────────────────────

describe("buildProductPricingSummary — full happy path", () => {
  it("returns correct summary for a fully configured product", () => {
    const result = buildProductPricingSummary({
      sellingPrice: 5.0,
      adjustedCost: 1.5,
      product: noOverrideProduct,
      globalSettings: globalDefault,
    });

    expect(result.sellingPrice).toBe(5.0);
    expect(result.adjustedCost).toBe(1.5);
    expect(result.actualCostPercent).toBeCloseTo(30, 5);
    expect(result.actualMarginPercent).toBeCloseTo(70, 5);
    expect(result.recommendedPrice).toBeCloseTo(5.0, 5);
    expect(result.priceGap).toBeCloseTo(0, 5);
    expect(result.pricingStatus).toBe("ON_TARGET");
  });
});

describe("buildProductPricingSummary — no recipe cost", () => {
  it("returns NO_RECIPE_COST status", () => {
    const result = buildProductPricingSummary({
      sellingPrice: 5.0,
      adjustedCost: null,
      product: noOverrideProduct,
      globalSettings: globalDefault,
    });
    expect(result.pricingStatus).toBe("NO_RECIPE_COST");
    expect(result.recommendedPrice).toBeNull();
  });
});

describe("buildProductPricingSummary — no selling price", () => {
  it("returns NO_SELLING_PRICE status", () => {
    const result = buildProductPricingSummary({
      sellingPrice: null,
      adjustedCost: 1.5,
      product: noOverrideProduct,
      globalSettings: globalDefault,
    });
    expect(result.pricingStatus).toBe("NO_SELLING_PRICE");
    expect(result.actualCostPercent).toBeNull();
    expect(result.actualMarginPercent).toBeNull();
    // Recommended price is still calculated (doesn't need selling price)
    expect(result.recommendedPrice).toBeCloseTo(5.0, 5);
  });
});

describe("buildProductPricingSummary — no target", () => {
  it("returns NO_TARGET status when no global and no product override", () => {
    const result = buildProductPricingSummary({
      sellingPrice: 5.0,
      adjustedCost: 1.5,
      product: noOverrideProduct,
      globalSettings: null,
    });
    expect(result.pricingStatus).toBe("NO_TARGET");
    expect(result.recommendedPrice).toBeNull();
  });
});

describe("buildProductPricingSummary — product override", () => {
  it("uses product override over global default", () => {
    const result = buildProductPricingSummary({
      sellingPrice: 5.0,
      adjustedCost: 2.0,
      product: costOverrideProduct, // 25%
      globalSettings: globalDefault,   // 30%
    });
    // With 25% cost target: recommended = 2.0 / 0.25 = 8.00
    expect(result.recommendedPrice).toBeCloseTo(8.0, 5);
    expect(result.effectiveTarget?.isOverride).toBe(true);
    expect(result.effectiveTarget?.targetPercent).toBe(25);
  });
});

describe("buildProductPricingSummary — rounding applied", () => {
  it("applies NEAREST_1_00 rounding to recommended price", () => {
    const settings = { ...globalDefault, defaultPriceRounding: RecommendedPriceRounding.NEAREST_1_00 };
    const result = buildProductPricingSummary({
      sellingPrice: 5.0,
      adjustedCost: 1.6,  // 1.6 / 0.30 = 5.333... → rounded to 5
      product: noOverrideProduct,
      globalSettings: settings,
    });
    expect(result.recommendedPrice).toBe(5);
  });
});
