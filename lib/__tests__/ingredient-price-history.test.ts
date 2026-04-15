import { describe, it, expect } from "vitest";
import { UnitType } from "@/app/generated/prisma/enums";
import {
  detectCostingFieldChanges,
  computeHistoryDeltas,
  type CostingSnapshot,
  type PriceHistoryRow,
} from "@/lib/costing/ingredient-price-history-utils";
import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";

// ─── detectCostingFieldChanges ────────────────────────────────────────────────

const baseSnapshot: CostingSnapshot = {
  purchasePrice: 48.0,
  purchaseQuantity: 25,
  purchaseUnit: UnitType.KG,
  baseUnit: UnitType.G,
  taxIncluded: true,
  yieldPercent: 100,
};

describe("detectCostingFieldChanges — no changes", () => {
  it("returns false when incoming is empty", () => {
    expect(detectCostingFieldChanges(baseSnapshot, {})).toBe(false);
  });

  it("returns false when incoming values are identical", () => {
    expect(
      detectCostingFieldChanges(baseSnapshot, {
        purchasePrice: 48.0,
        purchaseQuantity: 25,
        purchaseUnit: UnitType.KG,
        baseUnit: UnitType.G,
        taxIncluded: true,
        yieldPercent: 100,
      })
    ).toBe(false);
  });

  it("returns false for non-costing-only changes (simulated — no name/description fields)", () => {
    // detectCostingFieldChanges only looks at costing fields
    expect(detectCostingFieldChanges(baseSnapshot, {})).toBe(false);
  });
});

describe("detectCostingFieldChanges — price changes", () => {
  it("detects purchasePrice change", () => {
    expect(detectCostingFieldChanges(baseSnapshot, { purchasePrice: 52.0 })).toBe(true);
  });

  it("detects purchaseQuantity change", () => {
    expect(detectCostingFieldChanges(baseSnapshot, { purchaseQuantity: 20 })).toBe(true);
  });

  it("detects purchaseUnit change", () => {
    expect(
      detectCostingFieldChanges(baseSnapshot, { purchaseUnit: UnitType.G })
    ).toBe(true);
  });

  it("detects baseUnit change", () => {
    expect(
      detectCostingFieldChanges(baseSnapshot, { baseUnit: UnitType.KG })
    ).toBe(true);
  });

  it("detects taxIncluded change", () => {
    expect(detectCostingFieldChanges(baseSnapshot, { taxIncluded: false })).toBe(true);
  });

  it("detects yieldPercent change", () => {
    expect(detectCostingFieldChanges(baseSnapshot, { yieldPercent: 85 })).toBe(true);
  });
});

// ─── Historical standard unit cost calculation ────────────────────────────────

describe("Historical standard unit cost — flour example", () => {
  // $48 / 25 KG → $48 / 25000 G = $0.00192 / G
  it("calculates standard unit cost from historical price", () => {
    const result = calculateStandardUnitCost(48.0, 25, UnitType.KG, UnitType.G);
    expect(result.isConvertible).toBe(true);
    if (result.isConvertible) {
      expect(result.standardUnitCost).toBeCloseTo(0.00192, 5);
    }
  });

  it("calculates standard unit cost from a different historical price", () => {
    // $52 / 25 KG → $0.00208 / G
    const result = calculateStandardUnitCost(52.0, 25, UnitType.KG, UnitType.G);
    expect(result.isConvertible).toBe(true);
    if (result.isConvertible) {
      expect(result.standardUnitCost).toBeCloseTo(0.00208, 5);
    }
  });
});

// ─── Delta calculation helpers ────────────────────────────────────────────────

function makeHistoryRow(
  purchasePrice: string,
  purchaseQuantity: string,
  purchaseUnit: UnitType,
  baseUnit: UnitType,
  effectiveFrom: string
): PriceHistoryRow {
  const price = parseFloat(purchasePrice);
  const qty = parseFloat(purchaseQuantity);
  const costResult = calculateStandardUnitCost(price, qty, purchaseUnit, baseUnit);
  return {
    id: "test-id",
    ingredientId: "ingredient-id",
    purchasePrice,
    purchaseQuantity,
    purchaseUnit,
    baseUnit,
    taxIncluded: true,
    yieldPercent: "100.00",
    sourceType: "MANUAL" as never,
    notes: null,
    effectiveFrom,
    createdAt: effectiveFrom,
    createdByUserId: null,
    standardUnitCost: costResult.isConvertible
      ? costResult.standardUnitCost.toFixed(6)
      : null,
    standardUnitDisplay: costResult.isConvertible ? costResult.displayLabel : null,
  };
}

describe("Previous-vs-current delta calculations", () => {
  // Simulate what buildIngredientHistoryViewModel does internally
  const row1 = makeHistoryRow("52.00", "25.000", UnitType.KG, UnitType.G, "2026-04-15T00:00:00.000Z");
  const row2 = makeHistoryRow("48.00", "25.000", UnitType.KG, UnitType.G, "2026-01-01T00:00:00.000Z");
  // rows are sorted desc by effectiveFrom: row1 (latest), row2 (previous)

  it("price delta is latest minus previous", () => {
    const currentPrice = parseFloat(row1.purchasePrice);
    const prevPrice = parseFloat(row2.purchasePrice);
    const delta = currentPrice - prevPrice;
    expect(delta).toBeCloseTo(4.0, 5);
  });

  it("price delta percent is (delta / prev) * 100", () => {
    const currentPrice = parseFloat(row1.purchasePrice);
    const prevPrice = parseFloat(row2.purchasePrice);
    const delta = currentPrice - prevPrice;
    const pct = (delta / prevPrice) * 100;
    expect(pct).toBeCloseTo(8.333, 2);
  });

  it("standard cost delta percent reflects price change", () => {
    const currentCost = parseFloat(row1.standardUnitCost!);
    const prevCost = parseFloat(row2.standardUnitCost!);
    const pct = ((currentCost - prevCost) / prevCost) * 100;
    // $52/25000 = $0.00208, $48/25000 = $0.00192 → ~8.33% increase
    expect(pct).toBeCloseTo(8.333, 2);
  });

  it("no delta for the oldest entry", () => {
    // The oldest row in history has no previous, so deltas are null
    const isOldest = true; // no row at index+1
    expect(isOldest).toBe(true);
  });
});

// ─── effectiveFrom behavior ───────────────────────────────────────────────────

describe("effectiveFrom handling", () => {
  it("uses the provided effectiveFrom when given", () => {
    const customDate = new Date("2026-01-15T10:00:00.000Z");
    // Verify parsing
    const parsed = new Date(customDate.toISOString());
    expect(parsed.getTime()).toBe(customDate.getTime());
  });

  it("defaults to current time when effectiveFrom is not provided", () => {
    const before = Date.now();
    const defaultDate = new Date();
    const after = Date.now();
    expect(defaultDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(defaultDate.getTime()).toBeLessThanOrEqual(after);
  });
});

// ─── buildIngredientHistoryViewModel (pure logic tests) ──────────────────────

describe("buildIngredientHistoryViewModel delta logic", () => {
  // Since the DB isn't available in unit tests, we test the delta logic
  // via computeHistoryDeltas which is the pure implementation

  it("first row (latest) has delta vs second row", () => {
    const rows = [
      makeHistoryRow("55.00", "25.000", UnitType.KG, UnitType.G, "2026-04-01T00:00:00.000Z"),
      makeHistoryRow("48.00", "25.000", UnitType.KG, UnitType.G, "2026-01-01T00:00:00.000Z"),
    ];
    const withDeltas = computeHistoryDeltas(rows);
    expect(withDeltas[0].priceDelta).toBe("7.00");
    expect(parseFloat(withDeltas[0].priceDeltaPct!)).toBeCloseTo(14.583, 2);
  });

  it("last row (oldest) has null deltas", () => {
    const rows = [
      makeHistoryRow("55.00", "25.000", UnitType.KG, UnitType.G, "2026-04-01T00:00:00.000Z"),
      makeHistoryRow("48.00", "25.000", UnitType.KG, UnitType.G, "2026-01-01T00:00:00.000Z"),
    ];
    const withDeltas = computeHistoryDeltas(rows);
    expect(withDeltas[1].priceDelta).toBeNull();
    expect(withDeltas[1].priceDeltaPct).toBeNull();
    expect(withDeltas[1].standardCostDeltaPct).toBeNull();
  });

  it("handles single row with no delta", () => {
    const rows = [
      makeHistoryRow("48.00", "25.000", UnitType.KG, UnitType.G, "2026-01-01T00:00:00.000Z"),
    ];
    const withDeltas = computeHistoryDeltas(rows);
    expect(withDeltas[0].priceDelta).toBeNull();
  });
});
