import "server-only";
import { prisma } from "@/lib/db";
import { UnitType, PriceHistorySourceType } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";
import { computeHistoryDeltas } from "@/lib/costing/ingredient-price-history-utils";

export type {
  CostingSnapshot,
  PriceHistoryRow,
  PriceHistoryRowWithDelta,
  IngredientHistoryViewModel,
} from "@/lib/costing/ingredient-price-history-utils";
export { detectCostingFieldChanges } from "@/lib/costing/ingredient-price-history-utils";

import type {
  CostingSnapshot,
  PriceHistoryRow,
  IngredientHistoryViewModel,
} from "@/lib/costing/ingredient-price-history-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateHistorySnapshotInput = CostingSnapshot & {
  ingredientId: string;
  sourceType?: PriceHistorySourceType;
  notes?: string | null;
  effectiveFrom?: Date;
  createdByUserId?: string | null;
};

// ─── History snapshot creation ────────────────────────────────────────────────

export async function createIngredientHistorySnapshot(
  input: CreateHistorySnapshotInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  await db.ingredientPriceHistory.create({
    data: {
      ingredientId: input.ingredientId,
      purchasePrice: String(input.purchasePrice),
      purchaseQuantity: String(input.purchaseQuantity),
      purchaseUnit: input.purchaseUnit,
      baseUnit: input.baseUnit,
      taxIncluded: input.taxIncluded,
      yieldPercent: String(input.yieldPercent),
      sourceType: input.sourceType ?? PriceHistorySourceType.MANUAL,
      notes: input.notes ?? null,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

function toPriceHistoryRow(r: {
  id: string;
  ingredientId: string;
  purchasePrice: Prisma.Decimal;
  purchaseQuantity: Prisma.Decimal;
  purchaseUnit: UnitType;
  baseUnit: UnitType;
  taxIncluded: boolean;
  yieldPercent: Prisma.Decimal;
  sourceType: PriceHistorySourceType;
  notes: string | null;
  effectiveFrom: Date;
  createdAt: Date;
  createdByUserId: string | null;
}): PriceHistoryRow {
  const price = parseFloat(r.purchasePrice.toString());
  const qty = parseFloat(r.purchaseQuantity.toString());
  const costResult = calculateStandardUnitCost(price, qty, r.purchaseUnit, r.baseUnit);

  return {
    id: r.id,
    ingredientId: r.ingredientId,
    purchasePrice: r.purchasePrice.toFixed(2),
    purchaseQuantity: r.purchaseQuantity.toFixed(3),
    purchaseUnit: r.purchaseUnit,
    baseUnit: r.baseUnit,
    taxIncluded: r.taxIncluded,
    yieldPercent: r.yieldPercent.toFixed(2),
    sourceType: r.sourceType,
    notes: r.notes,
    effectiveFrom: r.effectiveFrom.toISOString(),
    createdAt: r.createdAt.toISOString(),
    createdByUserId: r.createdByUserId,
    standardUnitCost: costResult.isConvertible
      ? costResult.standardUnitCost.toFixed(6)
      : null,
    standardUnitDisplay: costResult.isConvertible ? costResult.displayLabel : null,
  };
}

export async function listIngredientPriceHistory(
  ingredientId: string
): Promise<PriceHistoryRow[]> {
  const rows = await prisma.ingredientPriceHistory.findMany({
    where: { ingredientId },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toPriceHistoryRow);
}

export async function getLatestIngredientHistory(
  ingredientId: string
): Promise<PriceHistoryRow | null> {
  const row = await prisma.ingredientPriceHistory.findFirst({
    where: { ingredientId },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
  if (!row) return null;
  return toPriceHistoryRow(row);
}

// ─── View model with delta comparisons ────────────────────────────────────────

export async function buildIngredientHistoryViewModel(
  ingredientId: string
): Promise<IngredientHistoryViewModel> {
  const rows = await listIngredientPriceHistory(ingredientId);
  return { rows: computeHistoryDeltas(rows) };
}
