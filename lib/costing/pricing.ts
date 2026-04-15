/**
 * Pure pricing calculation helpers (no server-only imports).
 * Can be imported in both service layer and tests.
 */

import { PricingTargetType, RecommendedPriceRounding } from "@/app/generated/prisma/enums";

export { PricingTargetType, RecommendedPriceRounding };

// ─── Types ────────────────────────────────────────────────────────────────────

export type EffectivePricingTarget = {
  targetType: PricingTargetType;
  targetPercent: number;
  /** true when the product has its own override, false when using global default */
  isOverride: boolean;
};

export type PricingStatus =
  | "ON_TARGET"
  | "ABOVE_TARGET"
  | "BELOW_TARGET"
  | "NO_SELLING_PRICE"
  | "NO_TARGET"
  | "NO_RECIPE_COST";

export type ProductPricingSummary = {
  sellingPrice: number | null;
  adjustedCost: number | null;
  actualCostPercent: number | null;
  actualMarginPercent: number | null;
  effectiveTarget: EffectivePricingTarget | null;
  recommendedPrice: number | null;
  priceGap: number | null;
  pricingStatus: PricingStatus;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the effective pricing target for a product.
 * Returns the product-level override if set, otherwise the global default.
 * Returns null if neither is configured.
 */
export function getEffectivePricingTarget(
  product: {
    pricingTargetType: PricingTargetType | null;
    pricingTargetPercent: string | number | null;
  },
  globalSettings: {
    defaultPricingTargetType: PricingTargetType;
    defaultPricingTargetPercent: string | number;
  } | null
): EffectivePricingTarget | null {
  const hasProductOverride =
    product.pricingTargetType !== null && product.pricingTargetPercent !== null;

  if (hasProductOverride) {
    const pct = parseFloat(String(product.pricingTargetPercent));
    if (pct > 0 && pct < 100) {
      return {
        targetType: product.pricingTargetType!,
        targetPercent: pct,
        isOverride: true,
      };
    }
  }

  if (globalSettings) {
    const pct = parseFloat(String(globalSettings.defaultPricingTargetPercent));
    if (pct > 0 && pct < 100) {
      return {
        targetType: globalSettings.defaultPricingTargetType,
        targetPercent: pct,
        isOverride: false,
      };
    }
  }

  return null;
}

/**
 * Calculates the actual cost percentage.
 * actualCostPercent = adjustedCost / sellingPrice * 100
 * Returns null if sellingPrice is missing or zero.
 */
export function calculateActualCostPercent(
  adjustedCost: number,
  sellingPrice: number | null
): number | null {
  if (sellingPrice === null || sellingPrice <= 0) return null;
  return (adjustedCost / sellingPrice) * 100;
}

/**
 * Calculates the actual margin percentage.
 * actualMarginPercent = (sellingPrice - adjustedCost) / sellingPrice * 100
 * Returns null if sellingPrice is missing or zero.
 */
export function calculateActualMarginPercent(
  adjustedCost: number,
  sellingPrice: number | null
): number | null {
  if (sellingPrice === null || sellingPrice <= 0) return null;
  return ((sellingPrice - adjustedCost) / sellingPrice) * 100;
}

/**
 * Calculates the recommended selling price based on target type and percent.
 * - COST_PERCENT:   recommendedPrice = adjustedCost / (targetPercent / 100)
 * - MARGIN_PERCENT: recommendedPrice = adjustedCost / (1 - targetPercent / 100)
 * Returns null if target is invalid or would produce a non-positive price.
 */
export function calculateRecommendedPrice(
  adjustedCost: number,
  target: EffectivePricingTarget | null
): number | null {
  if (target === null) return null;
  if (target.targetPercent <= 0 || target.targetPercent >= 100) return null;

  const pct = target.targetPercent / 100;

  if (target.targetType === PricingTargetType.COST_PERCENT) {
    return adjustedCost / pct;
  }

  // MARGIN_PERCENT: ensure divisor > 0 (already guaranteed by pct < 1)
  return adjustedCost / (1 - pct);
}

/**
 * Rounds a recommended price according to the chosen rounding mode.
 * - NONE:           no rounding
 * - NEAREST_0_10:   round to nearest $0.10
 * - NEAREST_0_50:   round to nearest $0.50
 * - NEAREST_1_00:   round to nearest $1.00
 */
export function roundRecommendedPrice(
  price: number,
  rounding: RecommendedPriceRounding
): number {
  switch (rounding) {
    case RecommendedPriceRounding.NEAREST_0_10:
      return Math.round(price * 10) / 10;
    case RecommendedPriceRounding.NEAREST_0_50:
      return Math.round(price * 2) / 2;
    case RecommendedPriceRounding.NEAREST_1_00:
      return Math.round(price);
    case RecommendedPriceRounding.NONE:
    default:
      return price;
  }
}

/**
 * Determines the pricing status by comparing recommended price to selling price.
 * A tolerance of 1% is applied for ON_TARGET.
 */
export function calculatePricingStatus(
  recommendedPrice: number | null,
  sellingPrice: number | null,
  adjustedCost: number | null,
  target: EffectivePricingTarget | null
): PricingStatus {
  if (adjustedCost === null) return "NO_RECIPE_COST";
  if (sellingPrice === null || sellingPrice <= 0) return "NO_SELLING_PRICE";
  if (target === null || recommendedPrice === null) return "NO_TARGET";

  const gap = sellingPrice - recommendedPrice;
  const tolerance = recommendedPrice * 0.005; // 0.5% tolerance

  if (Math.abs(gap) <= tolerance) return "ON_TARGET";
  if (gap > 0) return "ABOVE_TARGET";
  return "BELOW_TARGET";
}

/**
 * Builds the full pricing summary for a product.
 */
export function buildProductPricingSummary(opts: {
  sellingPrice: number | null;
  adjustedCost: number | null;
  product: {
    pricingTargetType: PricingTargetType | null;
    pricingTargetPercent: string | number | null;
  };
  globalSettings: {
    defaultPricingTargetType: PricingTargetType;
    defaultPricingTargetPercent: string | number;
    defaultPriceRounding: RecommendedPriceRounding;
  } | null;
  roundingOverride?: RecommendedPriceRounding;
}): ProductPricingSummary {
  const { sellingPrice, adjustedCost, product, globalSettings, roundingOverride } = opts;

  const effectiveTarget = getEffectivePricingTarget(product, globalSettings);

  if (adjustedCost === null) {
    return {
      sellingPrice,
      adjustedCost: null,
      actualCostPercent: null,
      actualMarginPercent: null,
      effectiveTarget,
      recommendedPrice: null,
      priceGap: null,
      pricingStatus: "NO_RECIPE_COST",
    };
  }

  const actualCostPercent = calculateActualCostPercent(adjustedCost, sellingPrice);
  const actualMarginPercent = calculateActualMarginPercent(adjustedCost, sellingPrice);

  const rawRecommended = calculateRecommendedPrice(adjustedCost, effectiveTarget);
  const rounding =
    roundingOverride ??
    globalSettings?.defaultPriceRounding ??
    RecommendedPriceRounding.NONE;
  const recommendedPrice =
    rawRecommended !== null ? roundRecommendedPrice(rawRecommended, rounding) : null;

  const priceGap =
    recommendedPrice !== null && sellingPrice !== null
      ? sellingPrice - recommendedPrice
      : null;

  const pricingStatus = calculatePricingStatus(
    recommendedPrice,
    sellingPrice,
    adjustedCost,
    effectiveTarget
  );

  return {
    sellingPrice,
    adjustedCost,
    actualCostPercent,
    actualMarginPercent,
    effectiveTarget,
    recommendedPrice,
    priceGap,
    pricingStatus,
  };
}
