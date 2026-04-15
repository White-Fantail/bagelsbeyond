import { UnitType } from "@/app/generated/prisma/enums";
import { getUnitGroup } from "./unit-groups";

// Multiplier to convert a quantity in `fromUnit` to `toUnit`.
// Only same-group conversions are allowed; COUNT units only support same-unit pairs.
const CONVERSION_FACTORS: Partial<Record<UnitType, Partial<Record<UnitType, number>>>> = {
  [UnitType.G]: { [UnitType.G]: 1, [UnitType.KG]: 0.001 },
  [UnitType.KG]: { [UnitType.KG]: 1, [UnitType.G]: 1000 },
  [UnitType.ML]: { [UnitType.ML]: 1, [UnitType.L]: 0.001 },
  [UnitType.L]: { [UnitType.L]: 1, [UnitType.ML]: 1000 },
  [UnitType.EA]: { [UnitType.EA]: 1 },
  [UnitType.PACK]: { [UnitType.PACK]: 1 },
  [UnitType.BOX]: { [UnitType.BOX]: 1 },
};

export type ConversionSuccess = { canConvert: true; factor: number };
export type ConversionFailure = { canConvert: false; errorCode: string; errorMessage: string };
export type ConversionCheck = ConversionSuccess | ConversionFailure;

export function getConversionFactor(fromUnit: UnitType, toUnit: UnitType): ConversionCheck {
  const fromGroup = getUnitGroup(fromUnit);
  const toGroup = getUnitGroup(toUnit);

  if (fromGroup !== toGroup) {
    return {
      canConvert: false,
      errorCode: "CROSS_GROUP",
      errorMessage: `${fromGroup.charAt(0) + fromGroup.slice(1).toLowerCase()} units cannot be converted to ${toGroup.toLowerCase()} units`,
    };
  }

  // COUNT group: only same-unit pairings are supported for now
  if (fromGroup === "COUNT" && fromUnit !== toUnit) {
    return {
      canConvert: false,
      errorCode: "COUNT_MISMATCH",
      errorMessage: `${fromUnit} to ${toUnit} conversion is not supported yet`,
    };
  }

  const factor = CONVERSION_FACTORS[fromUnit]?.[toUnit];
  if (factor === undefined) {
    return {
      canConvert: false,
      errorCode: "NO_FACTOR",
      errorMessage: `No conversion factor defined from ${fromUnit} to ${toUnit}`,
    };
  }

  return { canConvert: true, factor };
}

export function canConvertUnit(fromUnit: UnitType, toUnit: UnitType): boolean {
  return getConversionFactor(fromUnit, toUnit).canConvert;
}

export type QuantityConversionResult =
  | { success: true; result: number }
  | { success: false; errorCode: string; errorMessage: string };

export function convertQuantity(
  quantity: number,
  fromUnit: UnitType,
  toUnit: UnitType
): QuantityConversionResult {
  const check = getConversionFactor(fromUnit, toUnit);
  if (!check.canConvert) {
    return { success: false, errorCode: check.errorCode, errorMessage: check.errorMessage };
  }
  return { success: true, result: quantity * check.factor };
}
