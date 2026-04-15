/**
 * Pure supplier comparison analysis helpers.
 * No server-only import — safe to use in tests.
 */

import { UnitType, SupplierSyncMode } from "@/app/generated/prisma/enums";
import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupplierLinkSnapshot = {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierProductName: string;
  supplierProductCode: string | null;
  /** Purchase price on the ingredient master (used when link has no own price history) */
  purchasePrice: number;
  purchaseQuantity: number;
  purchaseUnit: UnitType;
  baseUnit: UnitType;
  /** Package quantity recorded on the supplier link (may differ from ingredient master) */
  supplierPackageQuantity: number | null;
  supplierPackageUnit: UnitType | null;
  supplierBaseUnit: UnitType | null;
  isPrimary: boolean;
  isActive: boolean;
  syncMode: SupplierSyncMode;
  lastCheckedAt: string | null;
  lastSyncStatus: string | null;
  /** Last synced purchase price from history (null if none) */
  lastSyncedPrice: number | null;
  /** Last synced quantity from history (null if none) */
  lastSyncedQuantity: number | null;
  /** Last synced purchase unit from history (null if none) */
  lastSyncedUnit: UnitType | null;
  /** Last synced base unit from history (null if none) */
  lastSyncedBaseUnit: UnitType | null;
  /** ISO date of last sync/update (null if never synced) */
  lastSyncedAt: string | null;
};

export type SyncHealthStatus = "ok" | "stale" | "unavailable" | "manual_only";

export type SupplierComparisonRow = {
  linkId: string;
  supplierId: string;
  supplierName: string;
  supplierProductName: string;
  supplierProductCode: string | null;
  isPrimary: boolean;
  isActive: boolean;
  syncMode: SupplierSyncMode;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
  /** Effective purchase price used for costing (synced price if available, else ingredient master) */
  effectivePurchasePrice: number;
  effectivePurchaseQuantity: number;
  effectivePurchaseUnit: UnitType;
  effectiveBaseUnit: UnitType;
  /** Normalized standard unit cost ($/baseUnit); null if conversion not supported */
  standardUnitCost: number | null;
  standardUnitDisplay: string | null;
  /** Delta vs. primary supplier standard unit cost; null if primary or primary cost unavailable */
  deltaVsPrimary: number | null;
  /** Percent delta vs. primary; null if primary or primary cost unavailable */
  deltaVsPrimaryPct: number | null;
  /** Whether this link is cheaper, more expensive, or the primary */
  comparisonStatus: "primary" | "cheaper" | "more_expensive" | "same" | "unavailable";
  /** Data freshness status */
  syncHealthStatus: SyncHealthStatus;
};

export type IngredientSupplierComparison = {
  ingredientId: string;
  ingredientName: string;
  primaryLinkId: string | null;
  primaryStandardUnitCost: number | null;
  cheapestLinkId: string | null;
  cheapestStandardUnitCost: number | null;
  links: SupplierComparisonRow[];
  hasAnyStaleLinks: boolean;
  hasCheaperAlternate: boolean;
};

// ─── Stale detection ──────────────────────────────────────────────────────────

/** Days after which a supplier link is considered stale */
export const STALE_DAYS = 30;

export function isStaleLinkDate(lastCheckedAt: string | null): boolean {
  if (!lastCheckedAt) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  return new Date(lastCheckedAt) < cutoff;
}

export function getSyncHealthStatus(link: {
  isActive: boolean;
  syncMode: SupplierSyncMode;
  lastCheckedAt: string | null;
  lastSyncStatus: string | null;
}): SyncHealthStatus {
  if (!link.isActive) return "unavailable";
  if (link.syncMode === SupplierSyncMode.MANUAL_ONLY) return "manual_only";
  if (isStaleLinkDate(link.lastCheckedAt)) return "stale";
  if (link.lastSyncStatus && link.lastSyncStatus.toLowerCase().includes("fail")) return "stale";
  return "ok";
}

// ─── Effective costing values ─────────────────────────────────────────────────

/**
 * Resolves which price/qty/unit values to use for costing a supplier link.
 * Prefers lastSynced values when available, falls back to ingredient master values.
 */
export function resolveEffectiveCostingValues(link: SupplierLinkSnapshot): {
  price: number;
  quantity: number;
  purchaseUnit: UnitType;
  baseUnit: UnitType;
} {
  if (
    link.lastSyncedPrice !== null &&
    link.lastSyncedQuantity !== null &&
    link.lastSyncedUnit !== null &&
    link.lastSyncedBaseUnit !== null
  ) {
    return {
      price: link.lastSyncedPrice,
      quantity: link.lastSyncedQuantity,
      purchaseUnit: link.lastSyncedUnit,
      baseUnit: link.lastSyncedBaseUnit,
    };
  }
  // Use supplier package data if available, otherwise ingredient master data
  const quantity =
    link.supplierPackageQuantity !== null ? link.supplierPackageQuantity : link.purchaseQuantity;
  const purchaseUnit = link.supplierPackageUnit !== null ? link.supplierPackageUnit : link.purchaseUnit;
  const baseUnit = link.supplierBaseUnit !== null ? link.supplierBaseUnit : link.baseUnit;
  return { price: link.purchasePrice, quantity, purchaseUnit, baseUnit };
}

// ─── Comparison builder ───────────────────────────────────────────────────────

/**
 * Builds a full supplier comparison for a single ingredient.
 * All comparison is based on normalized standard unit cost.
 */
export function buildIngredientSupplierComparison(
  ingredientId: string,
  ingredientName: string,
  links: SupplierLinkSnapshot[]
): IngredientSupplierComparison {
  // Resolve effective costing for each link
  const costed = links.map((link) => {
    const effective = resolveEffectiveCostingValues(link);
    const costResult = calculateStandardUnitCost(
      effective.price,
      effective.quantity,
      effective.purchaseUnit,
      effective.baseUnit
    );
    return {
      link,
      effective,
      standardUnitCost: costResult.isConvertible ? costResult.standardUnitCost : null,
      standardUnitDisplay: costResult.isConvertible ? costResult.displayLabel : null,
    };
  });

  // Find primary link
  const primaryEntry = costed.find((c) => c.link.isPrimary) ?? null;
  const primaryStandardUnitCost = primaryEntry?.standardUnitCost ?? null;
  const primaryLinkId = primaryEntry?.link.id ?? null;

  // Find cheapest link (lowest standardUnitCost, active links only)
  const activeCosted = costed.filter((c) => c.link.isActive && c.standardUnitCost !== null);
  let cheapestLinkId: string | null = null;
  let cheapestStandardUnitCost: number | null = null;
  if (activeCosted.length > 0) {
    const cheapest = activeCosted.reduce((best, cur) =>
      cur.standardUnitCost! < best.standardUnitCost! ? cur : best
    );
    cheapestLinkId = cheapest.link.id;
    cheapestStandardUnitCost = cheapest.standardUnitCost;
  }

  const rows: SupplierComparisonRow[] = costed.map(({ link, effective, standardUnitCost, standardUnitDisplay }) => {
    const syncHealthStatus = getSyncHealthStatus(link);

    let deltaVsPrimary: number | null = null;
    let deltaVsPrimaryPct: number | null = null;
    let comparisonStatus: SupplierComparisonRow["comparisonStatus"];

    if (link.isPrimary) {
      comparisonStatus = "primary";
    } else if (!link.isActive || standardUnitCost === null || primaryStandardUnitCost === null) {
      comparisonStatus = "unavailable";
    } else {
      deltaVsPrimary = standardUnitCost - primaryStandardUnitCost;
      deltaVsPrimaryPct =
        primaryStandardUnitCost !== 0
          ? (deltaVsPrimary / primaryStandardUnitCost) * 100
          : null;
      const tolerance = primaryStandardUnitCost * 0.001; // 0.1% tolerance
      if (Math.abs(deltaVsPrimary) <= tolerance) {
        comparisonStatus = "same";
      } else if (deltaVsPrimary < 0) {
        comparisonStatus = "cheaper";
      } else {
        comparisonStatus = "more_expensive";
      }
    }

    return {
      linkId: link.id,
      supplierId: link.supplierId,
      supplierName: link.supplierName,
      supplierProductName: link.supplierProductName,
      supplierProductCode: link.supplierProductCode,
      isPrimary: link.isPrimary,
      isActive: link.isActive,
      syncMode: link.syncMode,
      lastCheckedAt: link.lastCheckedAt,
      lastSyncedAt: link.lastSyncedAt,
      effectivePurchasePrice: effective.price,
      effectivePurchaseQuantity: effective.quantity,
      effectivePurchaseUnit: effective.purchaseUnit,
      effectiveBaseUnit: effective.baseUnit,
      standardUnitCost,
      standardUnitDisplay,
      deltaVsPrimary,
      deltaVsPrimaryPct,
      comparisonStatus,
      syncHealthStatus,
    };
  });

  const hasAnyStaleLinks = rows.some(
    (r) => r.syncHealthStatus === "stale" || r.syncHealthStatus === "unavailable"
  );
  const hasCheaperAlternate =
    cheapestLinkId !== null && cheapestLinkId !== primaryLinkId;

  return {
    ingredientId,
    ingredientName,
    primaryLinkId,
    primaryStandardUnitCost,
    cheapestLinkId,
    cheapestStandardUnitCost,
    links: rows,
    hasAnyStaleLinks,
    hasCheaperAlternate,
  };
}

// ─── Cross-ingredient summaries ───────────────────────────────────────────────

export type CheaperAlternateEntry = {
  ingredientId: string;
  ingredientName: string;
  primarySupplierName: string;
  primaryStandardUnitCost: number;
  cheapestSupplierName: string;
  cheapestStandardUnitCost: number;
  savingPerUnit: number;
  savingPct: number;
};

/**
 * Filters a list of ingredient comparisons to only those with cheaper alternatives.
 * Sorted by saving percentage descending.
 */
export function getCheaperAlternateSuppliers(
  comparisons: IngredientSupplierComparison[]
): CheaperAlternateEntry[] {
  const results: CheaperAlternateEntry[] = [];

  for (const comp of comparisons) {
    if (!comp.hasCheaperAlternate) continue;
    if (comp.primaryStandardUnitCost === null || comp.cheapestStandardUnitCost === null) continue;
    if (comp.cheapestLinkId === null || comp.cheapestLinkId === comp.primaryLinkId) continue;

    const primaryLink = comp.links.find((l) => l.isPrimary);
    const cheapestLink = comp.links.find((l) => l.linkId === comp.cheapestLinkId);
    if (!primaryLink || !cheapestLink) continue;

    const saving = comp.primaryStandardUnitCost - comp.cheapestStandardUnitCost;
    const savingPct = (saving / comp.primaryStandardUnitCost) * 100;

    results.push({
      ingredientId: comp.ingredientId,
      ingredientName: comp.ingredientName,
      primarySupplierName: primaryLink.supplierName,
      primaryStandardUnitCost: comp.primaryStandardUnitCost,
      cheapestSupplierName: cheapestLink.supplierName,
      cheapestStandardUnitCost: comp.cheapestStandardUnitCost,
      savingPerUnit: saving,
      savingPct,
    });
  }

  return results.sort((a, b) => b.savingPct - a.savingPct);
}

export type SyncIssueEntry = {
  ingredientId: string;
  ingredientName: string;
  linkId: string;
  supplierName: string;
  syncHealthStatus: SyncHealthStatus;
  lastCheckedAt: string | null;
};

/**
 * Returns supplier links that have sync issues (stale or unavailable),
 * excluding manual-only links.
 */
export function getSupplierSyncIssues(
  comparisons: IngredientSupplierComparison[]
): SyncIssueEntry[] {
  const results: SyncIssueEntry[] = [];
  for (const comp of comparisons) {
    for (const link of comp.links) {
      if (link.syncHealthStatus === "stale" || link.syncHealthStatus === "unavailable") {
        results.push({
          ingredientId: comp.ingredientId,
          ingredientName: comp.ingredientName,
          linkId: link.linkId,
          supplierName: link.supplierName,
          syncHealthStatus: link.syncHealthStatus,
          lastCheckedAt: link.lastCheckedAt,
        });
      }
    }
  }
  return results;
}
