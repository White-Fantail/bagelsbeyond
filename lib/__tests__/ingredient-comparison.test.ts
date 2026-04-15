import { describe, it, expect } from "vitest";
import { UnitType, SupplierSyncMode } from "@/app/generated/prisma/enums";
import {
  buildIngredientSupplierComparison,
  getCheaperAlternateSuppliers,
  getSupplierSyncIssues,
  getSyncHealthStatus,
  isStaleLinkDate,
  resolveEffectiveCostingValues,
  STALE_DAYS,
  type SupplierLinkSnapshot,
} from "@/lib/costing/analysis/ingredient-comparison";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const freshDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago
const staleDate = new Date(Date.now() - (STALE_DAYS + 5) * 24 * 60 * 60 * 1000).toISOString();

function makeLink(overrides: Partial<SupplierLinkSnapshot> = {}): SupplierLinkSnapshot {
  return {
    id: "link-1",
    supplierId: "sup-1",
    supplierName: "SupplierA",
    supplierProductName: "Flour 25kg",
    supplierProductCode: null,
    purchasePrice: 48,
    purchaseQuantity: 25,
    purchaseUnit: UnitType.KG,
    baseUnit: UnitType.G,
    supplierPackageQuantity: null,
    supplierPackageUnit: null,
    supplierBaseUnit: null,
    isPrimary: true,
    isActive: true,
    syncMode: SupplierSyncMode.API_READY,
    lastCheckedAt: freshDate,
    lastSyncStatus: "success",
    lastSyncedPrice: null,
    lastSyncedQuantity: null,
    lastSyncedUnit: null,
    lastSyncedBaseUnit: null,
    lastSyncedAt: null,
    ...overrides,
  };
}

// ─── isStaleLinkDate ──────────────────────────────────────────────────────────

describe("isStaleLinkDate", () => {
  it("returns true when lastCheckedAt is null", () => {
    expect(isStaleLinkDate(null)).toBe(true);
  });

  it("returns false for a recent date", () => {
    expect(isStaleLinkDate(freshDate)).toBe(false);
  });

  it("returns true for a stale date", () => {
    expect(isStaleLinkDate(staleDate)).toBe(true);
  });
});

// ─── getSyncHealthStatus ──────────────────────────────────────────────────────

describe("getSyncHealthStatus", () => {
  it("returns unavailable for inactive link", () => {
    expect(getSyncHealthStatus({ isActive: false, syncMode: SupplierSyncMode.API_READY, lastCheckedAt: freshDate, lastSyncStatus: "success" })).toBe("unavailable");
  });

  it("returns manual_only for MANUAL_ONLY syncMode", () => {
    expect(getSyncHealthStatus({ isActive: true, syncMode: SupplierSyncMode.MANUAL_ONLY, lastCheckedAt: freshDate, lastSyncStatus: null })).toBe("manual_only");
  });

  it("returns stale when lastCheckedAt is stale", () => {
    expect(getSyncHealthStatus({ isActive: true, syncMode: SupplierSyncMode.API_READY, lastCheckedAt: staleDate, lastSyncStatus: "success" })).toBe("stale");
  });

  it("returns stale when lastSyncStatus includes fail", () => {
    expect(getSyncHealthStatus({ isActive: true, syncMode: SupplierSyncMode.API_READY, lastCheckedAt: freshDate, lastSyncStatus: "failed" })).toBe("stale");
  });

  it("returns ok for fresh, active, synced link", () => {
    expect(getSyncHealthStatus({ isActive: true, syncMode: SupplierSyncMode.API_READY, lastCheckedAt: freshDate, lastSyncStatus: "success" })).toBe("ok");
  });
});

// ─── resolveEffectiveCostingValues ────────────────────────────────────────────

describe("resolveEffectiveCostingValues", () => {
  it("prefers synced values when available", () => {
    const link = makeLink({
      lastSyncedPrice: 50,
      lastSyncedQuantity: 20,
      lastSyncedUnit: UnitType.KG,
      lastSyncedBaseUnit: UnitType.G,
    });
    const result = resolveEffectiveCostingValues(link);
    expect(result.price).toBe(50);
    expect(result.quantity).toBe(20);
    expect(result.purchaseUnit).toBe(UnitType.KG);
  });

  it("uses supplier package values when no synced values", () => {
    const link = makeLink({
      supplierPackageQuantity: 10,
      supplierPackageUnit: UnitType.KG,
      supplierBaseUnit: UnitType.G,
    });
    const result = resolveEffectiveCostingValues(link);
    expect(result.quantity).toBe(10);
    expect(result.purchaseUnit).toBe(UnitType.KG);
  });

  it("falls back to ingredient master values", () => {
    const link = makeLink();
    const result = resolveEffectiveCostingValues(link);
    expect(result.price).toBe(48);
    expect(result.quantity).toBe(25);
  });
});

// ─── buildIngredientSupplierComparison ───────────────────────────────────────

describe("buildIngredientSupplierComparison — single primary link", () => {
  it("returns comparison with primary link marked correctly", () => {
    const link = makeLink({ id: "link-1", isPrimary: true });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [link]);

    expect(comp.ingredientId).toBe("ing-1");
    expect(comp.primaryLinkId).toBe("link-1");
    expect(comp.links).toHaveLength(1);
    expect(comp.links[0].comparisonStatus).toBe("primary");
  });

  it("calculates standard unit cost correctly", () => {
    // $48 / 25 KG → $48 / 25000 G = $0.00192 / G
    const link = makeLink({ id: "link-1", isPrimary: true });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [link]);
    expect(comp.primaryStandardUnitCost).toBeCloseTo(0.00192, 5);
  });
});

describe("buildIngredientSupplierComparison — cheaper alternate detection", () => {
  it("detects cheaper alternate supplier", () => {
    const primary = makeLink({ id: "link-1", supplierId: "sup-1", supplierName: "SupplierA", isPrimary: true });
    // $40 / 25 KG → $0.0016 / G — cheaper than $0.00192
    const alternate = makeLink({
      id: "link-2",
      supplierId: "sup-2",
      supplierName: "SupplierB",
      isPrimary: false,
      purchasePrice: 40,
    });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [primary, alternate]);

    expect(comp.hasCheaperAlternate).toBe(true);
    expect(comp.cheapestLinkId).toBe("link-2");
  });

  it("marks alternate as more_expensive correctly", () => {
    const primary = makeLink({ id: "link-1", isPrimary: true });
    // $60 / 25 KG — more expensive
    const expensive = makeLink({
      id: "link-2",
      isPrimary: false,
      purchasePrice: 60,
    });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [primary, expensive]);

    const expRow = comp.links.find((l) => l.linkId === "link-2");
    expect(expRow?.comparisonStatus).toBe("more_expensive");
    expect(expRow?.deltaVsPrimary).toBeGreaterThan(0);
    expect(comp.hasCheaperAlternate).toBe(false);
  });

  it("marks deltaVsPrimary as null for primary itself", () => {
    const primary = makeLink({ id: "link-1", isPrimary: true });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [primary]);
    expect(comp.links[0].deltaVsPrimary).toBeNull();
  });

  it("comparisonStatus is unavailable when inactive link", () => {
    const primary = makeLink({ id: "link-1", isPrimary: true });
    const inactive = makeLink({ id: "link-2", isPrimary: false, isActive: false });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [primary, inactive]);
    const inactiveRow = comp.links.find((l) => l.linkId === "link-2");
    expect(inactiveRow?.comparisonStatus).toBe("unavailable");
  });
});

describe("buildIngredientSupplierComparison — stale detection", () => {
  it("flags stale links in hasAnyStaleLinks", () => {
    const primary = makeLink({ id: "link-1", isPrimary: true, lastCheckedAt: staleDate });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [primary]);
    expect(comp.hasAnyStaleLinks).toBe(true);
  });

  it("does not flag fresh link as stale", () => {
    const primary = makeLink({ id: "link-1", isPrimary: true, lastCheckedAt: freshDate });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [primary]);
    // manual_only links don't count as stale; this link is API_READY and fresh
    expect(comp.links[0].syncHealthStatus).toBe("ok");
  });
});

// ─── getCheaperAlternateSuppliers ─────────────────────────────────────────────

describe("getCheaperAlternateSuppliers", () => {
  it("returns entries with cheaper alternates only", () => {
    const primary = makeLink({ id: "link-1", isPrimary: true, purchasePrice: 48 });
    const cheaper = makeLink({ id: "link-2", isPrimary: false, purchasePrice: 36 });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [primary, cheaper]);

    const results = getCheaperAlternateSuppliers([comp]);
    expect(results).toHaveLength(1);
    expect(results[0].ingredientName).toBe("Flour");
    expect(results[0].savingPct).toBeGreaterThan(0);
  });

  it("returns empty when no cheaper alternates", () => {
    const primary = makeLink({ id: "link-1", isPrimary: true });
    const expensive = makeLink({ id: "link-2", isPrimary: false, purchasePrice: 60 });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [primary, expensive]);
    expect(getCheaperAlternateSuppliers([comp])).toHaveLength(0);
  });

  it("sorts by saving percentage descending", () => {
    const p1 = makeLink({ id: "p1", isPrimary: true, purchasePrice: 48 });
    const c1 = makeLink({ id: "c1", isPrimary: false, purchasePrice: 36 }); // 25% cheaper
    const comp1 = buildIngredientSupplierComparison("ing-1", "Flour", [p1, c1]);

    const p2 = makeLink({ id: "p2", isPrimary: true, purchasePrice: 48 });
    const c2 = makeLink({ id: "c2", isPrimary: false, purchasePrice: 40 }); // ~16.7% cheaper
    const comp2 = buildIngredientSupplierComparison("ing-2", "Sugar", [p2, c2]);

    const results = getCheaperAlternateSuppliers([comp2, comp1]);
    expect(results[0].ingredientName).toBe("Flour"); // 25% > 16.7%
  });
});

// ─── getSupplierSyncIssues ────────────────────────────────────────────────────

describe("getSupplierSyncIssues", () => {
  it("returns stale links only, not ok/manual ones", () => {
    const good = makeLink({ id: "link-1", isPrimary: true, lastCheckedAt: freshDate });
    const stale = makeLink({ id: "link-2", isPrimary: false, lastCheckedAt: staleDate });
    const manual = makeLink({ id: "link-3", isPrimary: false, syncMode: SupplierSyncMode.MANUAL_ONLY });
    const comp = buildIngredientSupplierComparison("ing-1", "Flour", [good, stale, manual]);

    const issues = getSupplierSyncIssues([comp]);
    expect(issues).toHaveLength(1);
    expect(issues[0].linkId).toBe("link-2");
  });
});
