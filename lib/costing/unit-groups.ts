import { UnitType } from "@/app/generated/prisma/enums";

export type UnitGroup = "WEIGHT" | "VOLUME" | "COUNT";

export const UNIT_GROUP_MAP: Record<UnitType, UnitGroup> = {
  [UnitType.G]: "WEIGHT",
  [UnitType.KG]: "WEIGHT",
  [UnitType.ML]: "VOLUME",
  [UnitType.L]: "VOLUME",
  [UnitType.EA]: "COUNT",
  [UnitType.PACK]: "COUNT",
  [UnitType.BOX]: "COUNT",
};

export function getUnitGroup(unit: UnitType): UnitGroup {
  return UNIT_GROUP_MAP[unit];
}
