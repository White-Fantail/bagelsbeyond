import "server-only";
import { prisma } from "@/lib/db";
import { UnitType, PriceHistorySourceType } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  calculateStandardUnitCost,
  formatConvertedBaseQuantity,
} from "@/lib/costing/ingredient-cost";
import {
  createIngredientHistorySnapshot,
  detectCostingFieldChanges,
  type PriceHistoryRow,
  type PriceHistoryRowWithDelta,
  type IngredientHistoryViewModel,
} from "@/lib/costing/ingredient-price-history";
export type { PriceHistoryRow, PriceHistoryRowWithDelta, IngredientHistoryViewModel };

// ─── Types ────────────────────────────────────────────────────────────────────

export type IngredientCategoryRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type IngredientRow = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  purchasePrice: string;
  purchaseQuantity: string;
  purchaseUnit: UnitType;
  baseUnit: UnitType;
  yieldPercent: string;
  taxIncluded: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived costing fields (Phase 2)
  convertedBaseQuantity: string | null;
  standardUnitCost: string | null;
  standardUnitDisplay: string | null;
  conversionStatus: "ok" | "unsupported";
  // Phase 6 price history summary
  lastPriceUpdatedAt: string | null;
  lastPriceDelta: string | null;
  lastPriceDeltaPct: string | null;
  // Phase 7 supplier info
  primarySupplierName: string | null;
  supplierLinkCount: number;
};

export type ListIngredientsFilter = {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
};

export type CreateIngredientCategoryInput = {
  name: string;
  slug: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateIngredientCategoryInput = {
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type CreateIngredientInput = {
  name: string;
  categoryId?: string | null;
  description?: string | null;
  purchasePrice: string | number;
  purchaseQuantity: string | number;
  purchaseUnit: UnitType;
  baseUnit: UnitType;
  yieldPercent?: number;
  taxIncluded?: boolean;
  isActive?: boolean;
  notes?: string | null;
  // Phase 6 history fields
  effectiveFrom?: Date | string | null;
  changeNote?: string | null;
  createdByUserId?: string | null;
  // Phase 8 supplier link traceability
  ingredientSupplierLinkId?: string | null;
  // Phase 9 API sync source tracking
  sourceType?: PriceHistorySourceType;
};

export type UpdateIngredientInput = Partial<CreateIngredientInput>;

// ─── Ingredient Categories ─────────────────────────────────────────────────────

export async function listIngredientCategories(): Promise<IngredientCategoryRow[]> {
  const rows = await prisma.ingredientCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createIngredientCategory(
  input: CreateIngredientCategoryInput
): Promise<IngredientCategoryRow> {
  const row = await prisma.ingredientCategory.create({
    data: {
      name: input.name,
      slug: input.slug,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function updateIngredientCategory(
  id: string,
  input: UpdateIngredientCategoryInput
): Promise<IngredientCategoryRow> {
  const row = await prisma.ingredientCategory.update({
    where: { id },
    data: input,
  });
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

// ─── Ingredients ───────────────────────────────────────────────────────────────

function toIngredientRow(r: {
  id: string;
  name: string;
  categoryId: string | null;
  description: string | null;
  purchasePrice: Prisma.Decimal;
  purchaseQuantity: Prisma.Decimal;
  purchaseUnit: UnitType;
  baseUnit: UnitType;
  yieldPercent: Prisma.Decimal;
  taxIncluded: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { name: string } | null;
  priceHistory?: Array<{
    purchasePrice: Prisma.Decimal;
    purchaseQuantity: Prisma.Decimal;
    purchaseUnit: UnitType;
    baseUnit: UnitType;
    effectiveFrom: Date;
  }>;
  supplierLinks?: Array<{
    isPrimary: boolean;
    isActive: boolean;
    supplier: { name: string };
  }>;
}): IngredientRow {
  const price = parseFloat(r.purchasePrice.toString());
  const qty = parseFloat(r.purchaseQuantity.toString());
  const costResult = calculateStandardUnitCost(price, qty, r.purchaseUnit, r.baseUnit);

  // Compute last price update summary from first two history entries (sorted desc by effectiveFrom)
  const history = r.priceHistory ?? [];
  const latest = history[0] ?? null;
  const previous = history[1] ?? null;

  let lastPriceUpdatedAt: string | null = null;
  let lastPriceDelta: string | null = null;
  let lastPriceDeltaPct: string | null = null;

  if (latest) {
    lastPriceUpdatedAt = latest.effectiveFrom.toISOString();
    if (previous) {
      const latestPrice = parseFloat(latest.purchasePrice.toString());
      const prevPrice = parseFloat(previous.purchasePrice.toString());
      const delta = latestPrice - prevPrice;
      lastPriceDelta = delta.toFixed(2);
      lastPriceDeltaPct =
        prevPrice !== 0 ? (((delta) / prevPrice) * 100).toFixed(2) : null;
    }
  }

  const activeLinks = r.supplierLinks?.filter((l) => l.isActive) ?? [];
  const primaryLink = activeLinks.find((l) => l.isPrimary) ?? null;

  return {
    id: r.id,
    name: r.name,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    description: r.description,
    purchasePrice: r.purchasePrice.toFixed(2),
    purchaseQuantity: r.purchaseQuantity.toFixed(3),
    purchaseUnit: r.purchaseUnit,
    baseUnit: r.baseUnit,
    yieldPercent: r.yieldPercent.toFixed(2),
    taxIncluded: r.taxIncluded,
    isActive: r.isActive,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    convertedBaseQuantity: costResult.isConvertible
      ? formatConvertedBaseQuantity(costResult.convertedBaseQuantity, r.baseUnit)
      : null,
    standardUnitCost: costResult.isConvertible
      ? costResult.standardUnitCost.toFixed(6)
      : null,
    standardUnitDisplay: costResult.isConvertible ? costResult.displayLabel : null,
    conversionStatus: costResult.isConvertible ? "ok" : "unsupported",
    lastPriceUpdatedAt,
    lastPriceDelta,
    lastPriceDeltaPct,
    primarySupplierName: primaryLink?.supplier.name ?? null,
    supplierLinkCount: activeLinks.length,
  };
}

export async function listIngredients(
  filter: ListIngredientsFilter = {}
): Promise<IngredientRow[]> {
  const where: Prisma.IngredientWhereInput = {};

  if (filter.search) {
    where.name = { contains: filter.search, mode: "insensitive" };
  }
  if (filter.categoryId === "none") {
    where.categoryId = null;
  } else if (filter.categoryId) {
    where.categoryId = filter.categoryId;
  }
  if (filter.isActive !== undefined) {
    where.isActive = filter.isActive;
  }

  const rows = await prisma.ingredient.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      category: { select: { name: true } },
      priceHistory: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 2,
        select: {
          purchasePrice: true,
          purchaseQuantity: true,
          purchaseUnit: true,
          baseUnit: true,
          effectiveFrom: true,
        },
      },
      supplierLinks: {
        where: { isActive: true },
        select: {
          isPrimary: true,
          isActive: true,
          supplier: { select: { name: true } },
        },
      },
    },
  });

  return rows.map(toIngredientRow);
}

export async function getIngredientById(id: string): Promise<IngredientRow | null> {
  const row = await prisma.ingredient.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      priceHistory: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 2,
        select: {
          purchasePrice: true,
          purchaseQuantity: true,
          purchaseUnit: true,
          baseUnit: true,
          effectiveFrom: true,
        },
      },
      supplierLinks: {
        where: { isActive: true },
        select: {
          isPrimary: true,
          isActive: true,
          supplier: { select: { name: true } },
        },
      },
    },
  });
  if (!row) return null;
  return toIngredientRow(row);
}

export async function createIngredient(
  input: CreateIngredientInput
): Promise<IngredientRow> {
  const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.ingredient.create({
      data: {
        name: input.name,
        categoryId: input.categoryId ?? null,
        description: input.description ?? null,
        purchasePrice: String(input.purchasePrice),
        purchaseQuantity: String(input.purchaseQuantity),
        purchaseUnit: input.purchaseUnit,
        baseUnit: input.baseUnit,
        yieldPercent: input.yieldPercent !== undefined ? String(input.yieldPercent) : "100.00",
        taxIncluded: input.taxIncluded ?? true,
        isActive: input.isActive ?? true,
        notes: input.notes ?? null,
      },
      include: {
        category: { select: { name: true } },
        priceHistory: { take: 0 },
      },
    });

    await createIngredientHistorySnapshot(
      {
        ingredientId: created.id,
        purchasePrice: parseFloat(String(input.purchasePrice)),
        purchaseQuantity: parseFloat(String(input.purchaseQuantity)),
        purchaseUnit: input.purchaseUnit,
        baseUnit: input.baseUnit,
        taxIncluded: input.taxIncluded ?? true,
        yieldPercent: input.yieldPercent ?? 100,
        sourceType: PriceHistorySourceType.MANUAL,
        notes: input.changeNote ?? null,
        effectiveFrom,
        createdByUserId: input.createdByUserId ?? null,
      },
      tx
    );

    return created;
  });

  return toIngredientRow({ ...row, priceHistory: [], supplierLinks: [] });
}

export async function updateIngredient(
  id: string,
  input: UpdateIngredientInput
): Promise<IngredientRow> {
  const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();

  // Fetch current state for change detection
  const current = await prisma.ingredient.findUnique({ where: { id } });
  if (!current) throw new Error(`Ingredient ${id} not found`);

  const costingSnapshot = {
    purchasePrice: parseFloat(current.purchasePrice.toString()),
    purchaseQuantity: parseFloat(current.purchaseQuantity.toString()),
    purchaseUnit: current.purchaseUnit,
    baseUnit: current.baseUnit,
    taxIncluded: current.taxIncluded,
    yieldPercent: parseFloat(current.yieldPercent.toString()),
  };

  const incomingCosting = {
    purchasePrice: input.purchasePrice !== undefined ? parseFloat(String(input.purchasePrice)) : undefined,
    purchaseQuantity: input.purchaseQuantity !== undefined ? parseFloat(String(input.purchaseQuantity)) : undefined,
    purchaseUnit: input.purchaseUnit,
    baseUnit: input.baseUnit,
    taxIncluded: input.taxIncluded,
    yieldPercent: input.yieldPercent !== undefined ? Number(input.yieldPercent) : undefined,
  };

  const hasCostingChange = detectCostingFieldChanges(costingSnapshot, incomingCosting);

  const data: Prisma.IngredientUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.purchasePrice !== undefined) data.purchasePrice = String(input.purchasePrice);
  if (input.purchaseQuantity !== undefined) data.purchaseQuantity = String(input.purchaseQuantity);
  if (input.purchaseUnit !== undefined) data.purchaseUnit = input.purchaseUnit;
  if (input.baseUnit !== undefined) data.baseUnit = input.baseUnit;
  if (input.yieldPercent !== undefined) data.yieldPercent = String(input.yieldPercent);
  if (input.taxIncluded !== undefined) data.taxIncluded = input.taxIncluded;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.notes !== undefined) data.notes = input.notes;
  if ("categoryId" in input) {
    data.category = input.categoryId
      ? { connect: { id: input.categoryId } }
      : { disconnect: true };
  }

  if (!hasCostingChange) {
    // No costing change — just update without creating history
    const row = await prisma.ingredient.update({
      where: { id },
      data,
      include: {
        category: { select: { name: true } },
        priceHistory: {
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
          take: 2,
          select: {
            purchasePrice: true,
            purchaseQuantity: true,
            purchaseUnit: true,
            baseUnit: true,
            effectiveFrom: true,
          },
        },
      },
    });
    return toIngredientRow(row);
  }

  // Costing changed — update and create history in a transaction
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.ingredient.update({
      where: { id },
      data,
      include: {
        category: { select: { name: true } },
        priceHistory: {
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
          take: 2,
          select: {
            purchasePrice: true,
            purchaseQuantity: true,
            purchaseUnit: true,
            baseUnit: true,
            effectiveFrom: true,
          },
        },
      },
    });

    await createIngredientHistorySnapshot(
      {
        ingredientId: id,
        purchasePrice: parseFloat(updated.purchasePrice.toString()),
        purchaseQuantity: parseFloat(updated.purchaseQuantity.toString()),
        purchaseUnit: updated.purchaseUnit,
        baseUnit: updated.baseUnit,
        taxIncluded: updated.taxIncluded,
        yieldPercent: parseFloat(updated.yieldPercent.toString()),
        sourceType: input.sourceType ?? PriceHistorySourceType.MANUAL,
        notes: input.changeNote ?? null,
        effectiveFrom,
        createdByUserId: input.createdByUserId ?? null,
        ingredientSupplierLinkId: input.ingredientSupplierLinkId ?? null,
      },
      tx
    );

    return updated;
  });

  return toIngredientRow(row);
}

export async function archiveIngredient(id: string): Promise<IngredientRow> {
  const row = await prisma.ingredient.update({
    where: { id },
    data: { isActive: false },
    include: {
      category: { select: { name: true } },
      priceHistory: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 2,
        select: {
          purchasePrice: true,
          purchaseQuantity: true,
          purchaseUnit: true,
          baseUnit: true,
          effectiveFrom: true,
        },
      },
    },
  });
  return toIngredientRow(row);
}

// ─── Bulk Update ──────────────────────────────────────────────────────────────

export type BulkUpdateIngredientItem = {
  ingredientId: string;
  purchasePrice?: number;
  purchaseQuantity?: number;
  purchaseUnit?: UnitType;
  baseUnit?: UnitType;
  yieldPercent?: number;
  taxIncluded?: boolean;
  effectiveFrom?: Date | string | null;
  changeNote?: string | null;
  ingredientSupplierLinkId?: string | null;
  sourceType?: PriceHistorySourceType;
};

export type BulkUpdateResult = {
  updatedCount: number;
  skippedCount: number;
  errors: Array<{ ingredientId: string; message: string }>;
};

export async function bulkUpdateIngredients(
  items: BulkUpdateIngredientItem[],
  createdByUserId?: string | null
): Promise<BulkUpdateResult> {
  let updatedCount = 0;
  let skippedCount = 0;
  const errors: Array<{ ingredientId: string; message: string }> = [];

  for (const item of items) {
    try {
      await updateIngredient(item.ingredientId, {
        purchasePrice: item.purchasePrice,
        purchaseQuantity: item.purchaseQuantity,
        purchaseUnit: item.purchaseUnit,
        baseUnit: item.baseUnit,
        yieldPercent: item.yieldPercent,
        taxIncluded: item.taxIncluded,
        effectiveFrom: item.effectiveFrom,
        changeNote: item.changeNote,
        createdByUserId: createdByUserId ?? null,
        ingredientSupplierLinkId: item.ingredientSupplierLinkId ?? null,
      });
      updatedCount++;
    } catch (e) {
      errors.push({ ingredientId: item.ingredientId, message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return { updatedCount, skippedCount, errors };
}
