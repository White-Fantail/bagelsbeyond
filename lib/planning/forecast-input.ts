import "server-only";
import { prisma } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ForecastOverrideRow = {
  id: string;
  targetDate: string; // ISO date string (YYYY-MM-DD)
  productId: string;
  productName: string;
  predictedSalesQty: number;
  sourceType: "MANUAL" | "SYSTEM";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EffectiveForecastEntry = {
  productId: string;
  productName: string;
  predictedSalesQty: number;
  sourceType: "MANUAL" | "SYSTEM";
  hasOverride: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateOnly(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns all forecast overrides for a given target date.
 */
export async function getForecastOverridesForDate(
  targetDate: Date | string
): Promise<ForecastOverrideRow[]> {
  const dateStr = toDateOnly(targetDate);
  const rows = await prisma.forecastOverride.findMany({
    where: { targetDate: new Date(dateStr) },
    include: { product: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    targetDate: toDateOnly(r.targetDate),
    productId: r.productId,
    productName: r.product.name,
    predictedSalesQty: r.predictedSalesQty,
    sourceType: r.sourceType as "MANUAL" | "SYSTEM",
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Returns the effective forecast for a date — all plannable products with
 * their predicted sales qty, giving priority to manual overrides.
 *
 * Products with no override default to predictedSalesQty = 0 (no external
 * per-product forecast is available in Phase 12).
 */
export async function getEffectiveForecastForDate(
  targetDate: Date | string
): Promise<EffectiveForecastEntry[]> {
  const dateStr = toDateOnly(targetDate);

  const [products, overrides] = await Promise.all([
    prisma.menuProduct.findMany({
      where: { isActive: true, isProductionPlannable: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getForecastOverridesForDate(dateStr),
  ]);

  const overrideMap = new Map(overrides.map((o) => [o.productId, o]));

  return products.map((p) => {
    const override = overrideMap.get(p.id);
    if (override) {
      return {
        productId: p.id,
        productName: p.name,
        predictedSalesQty: override.predictedSalesQty,
        sourceType: override.sourceType,
        hasOverride: true,
      };
    }
    return {
      productId: p.id,
      productName: p.name,
      predictedSalesQty: 0,
      sourceType: "SYSTEM" as const,
      hasOverride: false,
    };
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

export type UpsertForecastOverrideInput = {
  targetDate: Date | string;
  productId: string;
  predictedSalesQty: number;
  sourceType?: "MANUAL" | "SYSTEM";
  notes?: string | null;
};

/**
 * Creates or updates a forecast override for a product on a given date.
 */
export async function upsertForecastOverride(
  input: UpsertForecastOverrideInput
): Promise<ForecastOverrideRow> {
  const dateStr = toDateOnly(input.targetDate);

  const product = await prisma.menuProduct.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true },
  });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  if (input.predictedSalesQty < 0) throw new Error("INVALID_QTY");

  const row = await prisma.forecastOverride.upsert({
    where: { targetDate_productId: { targetDate: new Date(dateStr), productId: input.productId } },
    create: {
      targetDate: new Date(dateStr),
      productId: input.productId,
      predictedSalesQty: input.predictedSalesQty,
      sourceType: input.sourceType ?? "MANUAL",
      notes: input.notes ?? null,
    },
    update: {
      predictedSalesQty: input.predictedSalesQty,
      sourceType: input.sourceType ?? "MANUAL",
      notes: input.notes ?? null,
    },
    include: { product: { select: { id: true, name: true } } },
  });

  return {
    id: row.id,
    targetDate: toDateOnly(row.targetDate),
    productId: row.productId,
    productName: row.product.name,
    predictedSalesQty: row.predictedSalesQty,
    sourceType: row.sourceType as "MANUAL" | "SYSTEM",
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Deletes a forecast override by ID.
 */
export async function deleteForecastOverride(id: string): Promise<void> {
  await prisma.forecastOverride.delete({ where: { id } });
}
