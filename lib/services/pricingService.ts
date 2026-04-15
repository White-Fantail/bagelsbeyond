import "server-only";
import { prisma } from "@/lib/db";
import { PricingTargetType, RecommendedPriceRounding } from "@/app/generated/prisma/enums";
import {
  buildProductPricingSummary,
  type ProductPricingSummary,
} from "@/lib/costing/pricing";
import type { MenuProductRow } from "./menuProductService";

export type { ProductPricingSummary };

export type GlobalPricingSettings = {
  defaultPricingTargetType: PricingTargetType;
  defaultPricingTargetPercent: string;
  defaultPriceRounding: RecommendedPriceRounding;
};

/**
 * Loads pricing settings from the global AppSetting record.
 * Returns defaults if no record exists.
 */
export async function getGlobalPricingSettings(): Promise<GlobalPricingSettings> {
  const settings = await prisma.appSetting.findFirst({
    select: {
      defaultPricingTargetType: true,
      defaultPricingTargetPercent: true,
      defaultPriceRounding: true,
    },
  });

  return {
    defaultPricingTargetType: settings?.defaultPricingTargetType ?? PricingTargetType.COST_PERCENT,
    defaultPricingTargetPercent: settings?.defaultPricingTargetPercent?.toString() ?? "30.00",
    defaultPriceRounding: settings?.defaultPriceRounding ?? RecommendedPriceRounding.NONE,
  };
}

/**
 * Builds the full pricing summary for a product given its adjusted recipe cost.
 */
export function buildPricingSummaryForProduct(
  product: Pick<MenuProductRow, "sellingPrice" | "pricingTargetType" | "pricingTargetPercent">,
  adjustedCost: number | null,
  globalSettings: GlobalPricingSettings | null
): ProductPricingSummary {
  const sellingPrice =
    product.sellingPrice !== null ? parseFloat(product.sellingPrice) : null;

  return buildProductPricingSummary({
    sellingPrice,
    adjustedCost,
    product: {
      pricingTargetType: product.pricingTargetType,
      pricingTargetPercent: product.pricingTargetPercent,
    },
    globalSettings: globalSettings
      ? {
          defaultPricingTargetType: globalSettings.defaultPricingTargetType,
          defaultPricingTargetPercent: globalSettings.defaultPricingTargetPercent,
          defaultPriceRounding: globalSettings.defaultPriceRounding,
        }
      : null,
  });
}
