/**
 * Pure costing-field-change detection and delta computation utilities.
 * No server-only import — safe to use in tests and shared contexts.
 */

import { UnitType } from "@/app/generated/prisma/enums";
import { PriceHistorySourceType } from "@/app/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CostingSnapshot = {
  purchasePrice: number;
  purchaseQuantity: number;
  purchaseUnit: UnitType;
  baseUnit: UnitType;
  taxIncluded: boolean;
  yieldPercent: number;
};

export type PriceHistoryRow = {
  id: string;
  ingredientId: string;
  purchasePrice: string;
  purchaseQuantity: string;
  purchaseUnit: UnitType;
  baseUnit: UnitType;
  taxIncluded: boolean;
  yieldPercent: string;
  sourceType: PriceHistorySourceType;
  notes: string | null;
  effectiveFrom: string;
  createdAt: string;
  createdByUserId: string | null;
  // Derived
  standardUnitCost: string | null;
  standardUnitDisplay: string | null;
};

export type PriceHistoryRowWithDelta = PriceHistoryRow & {
  priceDelta: string | null;
  priceDeltaPct: string | null;
  standardCostDeltaPct: string | null;
};

export type IngredientHistoryViewModel = {
  rows: PriceHistoryRowWithDelta[];
};

// ─── Costing field change detection ──────────────────────────────────────────

export function detectCostingFieldChanges(
  current: CostingSnapshot,
  incoming: Partial<CostingSnapshot>
): boolean {
  if (
    incoming.purchasePrice !== undefined &&
    Number(incoming.purchasePrice) !== Number(current.purchasePrice)
  )
    return true;
  if (
    incoming.purchaseQuantity !== undefined &&
    Number(incoming.purchaseQuantity) !== Number(current.purchaseQuantity)
  )
    return true;
  if (incoming.purchaseUnit !== undefined && incoming.purchaseUnit !== current.purchaseUnit)
    return true;
  if (incoming.baseUnit !== undefined && incoming.baseUnit !== current.baseUnit)
    return true;
  if (incoming.taxIncluded !== undefined && incoming.taxIncluded !== current.taxIncluded)
    return true;
  if (
    incoming.yieldPercent !== undefined &&
    Number(incoming.yieldPercent) !== Number(current.yieldPercent)
  )
    return true;
  return false;
}

// ─── Delta computation ────────────────────────────────────────────────────────

export function computeHistoryDeltas(
  rows: PriceHistoryRow[]
): PriceHistoryRowWithDelta[] {
  return rows.map((row, index) => {
    const prev = rows[index + 1] ?? null;

    if (!prev) {
      return { ...row, priceDelta: null, priceDeltaPct: null, standardCostDeltaPct: null };
    }

    const currentPrice = parseFloat(row.purchasePrice);
    const prevPrice = parseFloat(prev.purchasePrice);
    const priceDelta = currentPrice - prevPrice;
    const priceDeltaPct = prevPrice !== 0 ? (priceDelta / prevPrice) * 100 : null;

    let standardCostDeltaPct: string | null = null;
    if (row.standardUnitCost !== null && prev.standardUnitCost !== null) {
      const currentCost = parseFloat(row.standardUnitCost);
      const prevCost = parseFloat(prev.standardUnitCost);
      if (prevCost !== 0) {
        standardCostDeltaPct = (((currentCost - prevCost) / prevCost) * 100).toFixed(2);
      }
    }

    return {
      ...row,
      priceDelta: priceDelta.toFixed(2),
      priceDeltaPct: priceDeltaPct !== null ? priceDeltaPct.toFixed(2) : null,
      standardCostDeltaPct,
    };
  });
}
