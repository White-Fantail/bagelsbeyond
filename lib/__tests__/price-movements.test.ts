import { describe, it, expect } from "vitest";
import { UnitType, PriceHistorySourceType } from "@/app/generated/prisma/enums";
import {
  computeMovementDelta,
  sortByBiggestIncrease,
  sortByBiggestDecrease,
  filterRecentlyUpdated,
  buildStaleIngredients,
  isIngredientStale,
  daysSince,
  STALE_INGREDIENT_DAYS,
  type HistoryEntryInput,
} from "@/lib/costing/analysis/price-movements";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<HistoryEntryInput> = {}): HistoryEntryInput {
  return {
    id: "hist-1",
    ingredientId: "ing-1",
    purchasePrice: 48,
    purchaseQuantity: 25,
    purchaseUnit: UnitType.KG,
    baseUnit: UnitType.G,
    yieldPercent: 100,
    sourceType: PriceHistorySourceType.MANUAL,
    effectiveFrom: new Date("2024-06-01").toISOString(),
    createdAt: new Date("2024-06-01").toISOString(),
    ...overrides,
  };
}

// ─── computeMovementDelta ─────────────────────────────────────────────────────

describe("computeMovementDelta — no previous", () => {
  it("returns null deltas when no previous entry", () => {
    const current = makeEntry({ purchasePrice: 48 });
    const row = computeMovementDelta("ing-1", "Flour", current, null);
    expect(row.priceDelta).toBeNull();
    expect(row.priceDeltaPct).toBeNull();
    expect(row.standardCostDelta).toBeNull();
    expect(row.isFirstEntry).toBe(true);
  });

  it("still computes currentStandardUnitCost without previous", () => {
    const current = makeEntry({ purchasePrice: 48, purchaseQuantity: 25, purchaseUnit: UnitType.KG, baseUnit: UnitType.G });
    const row = computeMovementDelta("ing-1", "Flour", current, null);
    // $48 / 25 KG → $48 / 25000 G = $0.00192 / G
    expect(row.currentStandardUnitCost).toBeCloseTo(0.00192, 5);
    expect(row.previousStandardUnitCost).toBeNull();
  });
});

describe("computeMovementDelta — with previous", () => {
  it("correctly calculates price increase delta", () => {
    const prev = makeEntry({ purchasePrice: 40 });
    const curr = makeEntry({ purchasePrice: 48, effectiveFrom: new Date("2024-07-01").toISOString() });
    const row = computeMovementDelta("ing-1", "Flour", curr, prev);

    expect(row.priceDelta).toBeCloseTo(8, 4);
    expect(row.priceDeltaPct).toBeCloseTo(20, 2); // 8/40 * 100 = 20%
    expect(row.isFirstEntry).toBe(false);
  });

  it("correctly calculates price decrease delta", () => {
    const prev = makeEntry({ purchasePrice: 48 });
    const curr = makeEntry({ purchasePrice: 40, effectiveFrom: new Date("2024-07-01").toISOString() });
    const row = computeMovementDelta("ing-1", "Flour", curr, prev);

    expect(row.priceDelta).toBeCloseTo(-8, 4);
    expect(row.priceDeltaPct).toBeCloseTo(-16.67, 1); // -8/48 * 100
  });

  it("correctly calculates standard unit cost delta", () => {
    // prev: $48 / 25 KG = $0.00192 / G
    // curr: $60 / 25 KG = $0.0024 / G
    const prev = makeEntry({ purchasePrice: 48 });
    const curr = makeEntry({ purchasePrice: 60, effectiveFrom: new Date("2024-07-01").toISOString() });
    const row = computeMovementDelta("ing-1", "Flour", curr, prev);

    expect(row.standardCostDelta).toBeCloseTo(0.00048, 6);
    const expectedPct = (0.00048 / 0.00192) * 100;
    expect(row.standardCostDeltaPct).toBeCloseTo(expectedPct, 1); // 25%
  });

  it("returns null standardCostDelta when unit conversion fails", () => {
    const prev = makeEntry({ purchaseUnit: UnitType.KG, baseUnit: UnitType.ML }); // incompatible
    const curr = makeEntry({ purchaseUnit: UnitType.KG, baseUnit: UnitType.ML });
    const row = computeMovementDelta("ing-1", "TestIng", curr, prev);
    expect(row.standardCostDelta).toBeNull();
  });
});

// ─── sortByBiggestIncrease ────────────────────────────────────────────────────

describe("sortByBiggestIncrease", () => {
  it("returns only positive deltas, sorted descending", () => {
    const prev = makeEntry({ purchasePrice: 40 });
    const rows = [
      computeMovementDelta("ing-1", "A", makeEntry({ purchasePrice: 50 }), prev), // +25%
      computeMovementDelta("ing-2", "B", makeEntry({ purchasePrice: 60 }), prev), // +50%
      computeMovementDelta("ing-3", "C", makeEntry({ purchasePrice: 35 }), prev), // -12.5%
    ];
    const result = sortByBiggestIncrease(rows);
    expect(result).toHaveLength(2);
    expect(result[0].ingredientName).toBe("B"); // 50%
    expect(result[1].ingredientName).toBe("A"); // 25%
  });

  it("excludes entries with no delta (first entry)", () => {
    const row = computeMovementDelta("ing-1", "A", makeEntry(), null);
    expect(sortByBiggestIncrease([row])).toHaveLength(0);
  });
});

// ─── sortByBiggestDecrease ────────────────────────────────────────────────────

describe("sortByBiggestDecrease", () => {
  it("returns only negative deltas, most negative first", () => {
    const prev = makeEntry({ purchasePrice: 40 });
    const rows = [
      computeMovementDelta("ing-1", "A", makeEntry({ purchasePrice: 30 }), prev), // -25%
      computeMovementDelta("ing-2", "B", makeEntry({ purchasePrice: 20 }), prev), // -50%
      computeMovementDelta("ing-3", "C", makeEntry({ purchasePrice: 50 }), prev), // +25%
    ];
    const result = sortByBiggestDecrease(rows);
    expect(result).toHaveLength(2);
    expect(result[0].ingredientName).toBe("B"); // -50%
  });
});

// ─── filterRecentlyUpdated ────────────────────────────────────────────────────

describe("filterRecentlyUpdated", () => {
  it("returns only rows updated within the window", () => {
    const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const recent = computeMovementDelta(
      "ing-1",
      "A",
      makeEntry({ effectiveFrom: recentDate }),
      null
    );
    const old = computeMovementDelta(
      "ing-2",
      "B",
      makeEntry({ effectiveFrom: oldDate }),
      null
    );

    const result = filterRecentlyUpdated([recent, old], 7);
    expect(result).toHaveLength(1);
    expect(result[0].ingredientName).toBe("A");
  });
});

// ─── isIngredientStale / daysSince ───────────────────────────────────────────

describe("isIngredientStale", () => {
  it("returns true when lastUpdatedAt is null", () => {
    expect(isIngredientStale(null)).toBe(true);
  });

  it("returns true when last update is beyond staleDays", () => {
    const old = new Date(Date.now() - (STALE_INGREDIENT_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    expect(isIngredientStale(old)).toBe(true);
  });

  it("returns false for a recent update", () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(isIngredientStale(recent)).toBe(false);
  });
});

describe("daysSince", () => {
  it("returns null for null input", () => {
    expect(daysSince(null)).toBeNull();
  });

  it("returns approximately correct days", () => {
    const threeAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysSince(threeAgo)).toBe(3);
  });
});

// ─── buildStaleIngredients ────────────────────────────────────────────────────

describe("buildStaleIngredients", () => {
  it("includes ingredients with no update date", () => {
    const result = buildStaleIngredients([
      { ingredientId: "ing-1", ingredientName: "Flour", lastUpdatedAt: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].daysSinceUpdate).toBeNull();
  });

  it("excludes freshly updated ingredients", () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = buildStaleIngredients([
      { ingredientId: "ing-1", ingredientName: "Flour", lastUpdatedAt: recent },
    ]);
    expect(result).toHaveLength(0);
  });

  it("sorts by daysSinceUpdate descending (most stale first)", () => {
    const older = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const newer = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    const result = buildStaleIngredients([
      { ingredientId: "ing-1", ingredientName: "Flour", lastUpdatedAt: newer },
      { ingredientId: "ing-2", ingredientName: "Salt", lastUpdatedAt: older },
    ]);
    expect(result[0].ingredientName).toBe("Salt");
  });
});
