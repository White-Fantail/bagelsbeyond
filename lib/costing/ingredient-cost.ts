import { UnitType } from "@/app/generated/prisma/enums";
import { convertQuantity } from "./unit-conversion";

export type CostingSuccess = {
  isConvertible: true;
  convertedBaseQuantity: number;
  standardUnitCost: number;
  baseUnit: UnitType;
  displayLabel: string;
};

export type CostingFailure = {
  isConvertible: false;
  errorCode: string;
  errorMessage: string;
};

export type IngredientCostResult = CostingSuccess | CostingFailure;

export function calculateConvertedBaseQuantity(
  purchaseQuantity: number,
  purchaseUnit: UnitType,
  baseUnit: UnitType
): { success: true; result: number } | { success: false; errorCode: string; errorMessage: string } {
  return convertQuantity(purchaseQuantity, purchaseUnit, baseUnit);
}

export function calculateStandardUnitCost(
  purchasePrice: number,
  purchaseQuantity: number,
  purchaseUnit: UnitType,
  baseUnit: UnitType
): IngredientCostResult {
  const convResult = calculateConvertedBaseQuantity(purchaseQuantity, purchaseUnit, baseUnit);

  if (!convResult.success) {
    return {
      isConvertible: false,
      errorCode: convResult.errorCode,
      errorMessage: convResult.errorMessage,
    };
  }

  const convertedBaseQuantity = convResult.result;

  if (convertedBaseQuantity === 0) {
    return {
      isConvertible: false,
      errorCode: "ZERO_QUANTITY",
      errorMessage: "Converted base quantity is zero",
    };
  }

  const standardUnitCost = purchasePrice / convertedBaseQuantity;

  return {
    isConvertible: true,
    convertedBaseQuantity,
    standardUnitCost,
    baseUnit,
    displayLabel: formatStandardUnitCost(standardUnitCost, baseUnit),
  };
}

/**
 * Format a standard unit cost with sensible precision for small amounts.
 * Uses 4–6 decimal places depending on magnitude.
 */
export function formatStandardUnitCost(cost: number, unit: UnitType): string {
  let decimals: number;
  const abs = Math.abs(cost);
  if (abs >= 1) {
    decimals = 4;
  } else if (abs >= 0.01) {
    decimals = 4;
  } else if (abs >= 0.001) {
    decimals = 5;
  } else {
    decimals = 6;
  }
  return `$${cost.toFixed(decimals)} / ${unit}`;
}

/**
 * Format a converted base quantity for display (up to 3 decimal places,
 * trimming trailing zeros for whole numbers).
 */
export function formatConvertedBaseQuantity(qty: number, unit: UnitType): string {
  const formatted = Number.isInteger(qty) ? qty.toString() : qty.toFixed(3).replace(/\.?0+$/, "");
  return `${formatted} ${unit}`;
}
