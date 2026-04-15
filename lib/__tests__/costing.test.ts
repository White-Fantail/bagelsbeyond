import { describe, it, expect } from "vitest";
import { UnitType } from "@/app/generated/prisma/enums";
import { getUnitGroup } from "../costing/unit-groups";
import {
  canConvertUnit,
  convertQuantity,
  getConversionFactor,
} from "../costing/unit-conversion";
import {
  calculateStandardUnitCost,
  calculateConvertedBaseQuantity,
  formatStandardUnitCost,
  formatConvertedBaseQuantity,
} from "../costing/ingredient-cost";

// ─── Unit Groups ──────────────────────────────────────────────────────────────

describe("getUnitGroup", () => {
  it("returns WEIGHT for G and KG", () => {
    expect(getUnitGroup(UnitType.G)).toBe("WEIGHT");
    expect(getUnitGroup(UnitType.KG)).toBe("WEIGHT");
  });
  it("returns VOLUME for ML and L", () => {
    expect(getUnitGroup(UnitType.ML)).toBe("VOLUME");
    expect(getUnitGroup(UnitType.L)).toBe("VOLUME");
  });
  it("returns COUNT for EA, PACK, BOX", () => {
    expect(getUnitGroup(UnitType.EA)).toBe("COUNT");
    expect(getUnitGroup(UnitType.PACK)).toBe("COUNT");
    expect(getUnitGroup(UnitType.BOX)).toBe("COUNT");
  });
});

// ─── canConvertUnit ───────────────────────────────────────────────────────────

describe("canConvertUnit — valid pairs", () => {
  it("KG -> G is valid", () => expect(canConvertUnit(UnitType.KG, UnitType.G)).toBe(true));
  it("G -> KG is valid", () => expect(canConvertUnit(UnitType.G, UnitType.KG)).toBe(true));
  it("G -> G is valid", () => expect(canConvertUnit(UnitType.G, UnitType.G)).toBe(true));
  it("KG -> KG is valid", () => expect(canConvertUnit(UnitType.KG, UnitType.KG)).toBe(true));
  it("L -> ML is valid", () => expect(canConvertUnit(UnitType.L, UnitType.ML)).toBe(true));
  it("ML -> L is valid", () => expect(canConvertUnit(UnitType.ML, UnitType.L)).toBe(true));
  it("EA -> EA is valid", () => expect(canConvertUnit(UnitType.EA, UnitType.EA)).toBe(true));
  it("PACK -> PACK is valid", () => expect(canConvertUnit(UnitType.PACK, UnitType.PACK)).toBe(true));
  it("BOX -> BOX is valid", () => expect(canConvertUnit(UnitType.BOX, UnitType.BOX)).toBe(true));
});

describe("canConvertUnit — invalid pairs", () => {
  it("PACK -> EA is invalid", () => expect(canConvertUnit(UnitType.PACK, UnitType.EA)).toBe(false));
  it("BOX -> EA is invalid", () => expect(canConvertUnit(UnitType.BOX, UnitType.EA)).toBe(false));
  it("EA -> PACK is invalid", () => expect(canConvertUnit(UnitType.EA, UnitType.PACK)).toBe(false));
  it("KG -> ML is invalid", () => expect(canConvertUnit(UnitType.KG, UnitType.ML)).toBe(false));
  it("EA -> G is invalid", () => expect(canConvertUnit(UnitType.EA, UnitType.G)).toBe(false));
  it("G -> L is invalid", () => expect(canConvertUnit(UnitType.G, UnitType.L)).toBe(false));
  it("L -> KG is invalid", () => expect(canConvertUnit(UnitType.L, UnitType.KG)).toBe(false));
  it("BOX -> PACK is invalid", () => expect(canConvertUnit(UnitType.BOX, UnitType.PACK)).toBe(false));
});

describe("getConversionFactor — error codes", () => {
  it("returns CROSS_GROUP for KG -> ML", () => {
    const result = getConversionFactor(UnitType.KG, UnitType.ML);
    expect(result.canConvert).toBe(false);
    if (!result.canConvert) expect(result.errorCode).toBe("CROSS_GROUP");
  });
  it("returns COUNT_MISMATCH for PACK -> EA", () => {
    const result = getConversionFactor(UnitType.PACK, UnitType.EA);
    expect(result.canConvert).toBe(false);
    if (!result.canConvert) expect(result.errorCode).toBe("COUNT_MISMATCH");
  });
  it("returns COUNT_MISMATCH for BOX -> EA", () => {
    const result = getConversionFactor(UnitType.BOX, UnitType.EA);
    expect(result.canConvert).toBe(false);
    if (!result.canConvert) expect(result.errorCode).toBe("COUNT_MISMATCH");
  });
});

// ─── convertQuantity ──────────────────────────────────────────────────────────

describe("convertQuantity — valid conversions", () => {
  it("25 KG -> G = 25000", () => {
    const result = convertQuantity(25, UnitType.KG, UnitType.G);
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(25000);
  });
  it("1 G -> KG = 0.001", () => {
    const result = convertQuantity(1, UnitType.G, UnitType.KG);
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBeCloseTo(0.001);
  });
  it("2 L -> ML = 2000", () => {
    const result = convertQuantity(2, UnitType.L, UnitType.ML);
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(2000);
  });
  it("500 ML -> L = 0.5", () => {
    const result = convertQuantity(500, UnitType.ML, UnitType.L);
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBeCloseTo(0.5);
  });
  it("500 EA -> EA = 500", () => {
    const result = convertQuantity(500, UnitType.EA, UnitType.EA);
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(500);
  });
  it("10 PACK -> PACK = 10", () => {
    const result = convertQuantity(10, UnitType.PACK, UnitType.PACK);
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(10);
  });
});

describe("convertQuantity — invalid conversions", () => {
  it("PACK -> EA fails", () => {
    const result = convertQuantity(10, UnitType.PACK, UnitType.EA);
    expect(result.success).toBe(false);
  });
  it("KG -> ML fails", () => {
    const result = convertQuantity(1, UnitType.KG, UnitType.ML);
    expect(result.success).toBe(false);
  });
});

// ─── calculateStandardUnitCost ────────────────────────────────────────────────

describe("calculateStandardUnitCost — flour example (25 KG @ $48.00)", () => {
  // 25 KG -> 25000 G, $48.00 / 25000 G = $0.00192 / G
  const result = calculateStandardUnitCost(48.0, 25, UnitType.KG, UnitType.G);

  it("is convertible", () => expect(result.isConvertible).toBe(true));
  it("convertedBaseQuantity = 25000", () => {
    if (result.isConvertible) expect(result.convertedBaseQuantity).toBe(25000);
  });
  it("standardUnitCost ≈ 0.00192", () => {
    if (result.isConvertible) expect(result.standardUnitCost).toBeCloseTo(0.00192, 5);
  });
  it("baseUnit is G", () => {
    if (result.isConvertible) expect(result.baseUnit).toBe(UnitType.G);
  });
  it("displayLabel contains G", () => {
    if (result.isConvertible) expect(result.displayLabel).toContain("/ G");
  });
});

describe("calculateStandardUnitCost — cream cheese example (2 L @ $14.50)", () => {
  // 2 L -> 2000 ML, $14.50 / 2000 ML = $0.00725 / ML
  const result = calculateStandardUnitCost(14.5, 2, UnitType.L, UnitType.ML);

  it("is convertible", () => expect(result.isConvertible).toBe(true));
  it("convertedBaseQuantity = 2000", () => {
    if (result.isConvertible) expect(result.convertedBaseQuantity).toBe(2000);
  });
  it("standardUnitCost ≈ 0.00725", () => {
    if (result.isConvertible) expect(result.standardUnitCost).toBeCloseTo(0.00725, 5);
  });
});

describe("calculateStandardUnitCost — unsupported combination (PACK -> EA)", () => {
  const result = calculateStandardUnitCost(5.0, 10, UnitType.PACK, UnitType.EA);
  it("is not convertible", () => expect(result.isConvertible).toBe(false));
  it("has an errorCode", () => {
    if (!result.isConvertible) expect(result.errorCode).toBeTruthy();
  });
});

describe("calculateStandardUnitCost — unsupported combination (KG -> ML)", () => {
  const result = calculateStandardUnitCost(10.0, 1, UnitType.KG, UnitType.ML);
  it("is not convertible", () => expect(result.isConvertible).toBe(false));
  it("errorCode is CROSS_GROUP", () => {
    if (!result.isConvertible) expect(result.errorCode).toBe("CROSS_GROUP");
  });
});

// ─── calculateConvertedBaseQuantity ───────────────────────────────────────────

describe("calculateConvertedBaseQuantity", () => {
  it("25 KG -> G = 25000", () => {
    const result = calculateConvertedBaseQuantity(25, UnitType.KG, UnitType.G);
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(25000);
  });
  it("2 L -> ML = 2000", () => {
    const result = calculateConvertedBaseQuantity(2, UnitType.L, UnitType.ML);
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(2000);
  });
  it("500 EA -> EA = 500", () => {
    const result = calculateConvertedBaseQuantity(500, UnitType.EA, UnitType.EA);
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(500);
  });
});

// ─── Formatting helpers ───────────────────────────────────────────────────────

describe("formatStandardUnitCost", () => {
  it("formats cost >= 0.01 with 4 decimal places", () => {
    // 0.0725 >= 0.01 → 4 decimal places: "0.0725"
    expect(formatStandardUnitCost(0.0725, UnitType.ML)).toBe("$0.0725 / ML");
  });
  it("formats cost in [0.001, 0.01) with 5 decimal places", () => {
    // 0.002 is in [0.001, 0.01) → 5 decimal places: "0.00200"
    expect(formatStandardUnitCost(0.002, UnitType.G)).toBe("$0.00200 / G");
    // 0.00192 is in [0.001, 0.01) → 5 decimal places: "0.00192"
    expect(formatStandardUnitCost(0.00192, UnitType.G)).toBe("$0.00192 / G");
  });
  it("formats cost < 0.001 with 6 decimal places", () => {
    // 0.0001 < 0.001 → 6 decimal places: "0.000100"
    expect(formatStandardUnitCost(0.0001, UnitType.G)).toBe("$0.000100 / G");
  });
  it("formats larger cost with 4 decimal places", () => {
    expect(formatStandardUnitCost(1.5, UnitType.KG)).toBe("$1.5000 / KG");
  });
});

describe("formatConvertedBaseQuantity", () => {
  it("formats whole numbers without decimals", () => {
    expect(formatConvertedBaseQuantity(25000, UnitType.G)).toBe("25000 G");
  });
  it("formats decimal quantities trimming trailing zeros", () => {
    expect(formatConvertedBaseQuantity(0.5, UnitType.L)).toBe("0.5 L");
  });
});
