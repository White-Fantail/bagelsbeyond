import "server-only";
import { prisma } from "@/lib/db";
import { UnitType } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  calculateStandardUnitCost,
  formatConvertedBaseQuantity,
} from "@/lib/costing/ingredient-cost";

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
  taxIncluded?: boolean;
  isActive?: boolean;
  notes?: string | null;
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
  taxIncluded: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { name: string } | null;
}): IngredientRow {
  const price = parseFloat(r.purchasePrice.toString());
  const qty = parseFloat(r.purchaseQuantity.toString());
  const costResult = calculateStandardUnitCost(price, qty, r.purchaseUnit, r.baseUnit);

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
  };
}

export async function listIngredients(
  filter: ListIngredientsFilter = {}
): Promise<IngredientRow[]> {
  const where: Prisma.IngredientWhereInput = {};

  if (filter.search) {
    where.name = { contains: filter.search, mode: "insensitive" };
  }
  if (filter.categoryId) {
    where.categoryId = filter.categoryId;
  }
  if (filter.isActive !== undefined) {
    where.isActive = filter.isActive;
  }

  const rows = await prisma.ingredient.findMany({
    where,
    orderBy: { name: "asc" },
    include: { category: { select: { name: true } } },
  });

  return rows.map(toIngredientRow);
}

export async function getIngredientById(id: string): Promise<IngredientRow | null> {
  const row = await prisma.ingredient.findUnique({
    where: { id },
    include: { category: { select: { name: true } } },
  });
  if (!row) return null;
  return toIngredientRow(row);
}

export async function createIngredient(
  input: CreateIngredientInput
): Promise<IngredientRow> {
  const row = await prisma.ingredient.create({
    data: {
      name: input.name,
      categoryId: input.categoryId ?? null,
      description: input.description ?? null,
      purchasePrice: String(input.purchasePrice),
      purchaseQuantity: String(input.purchaseQuantity),
      purchaseUnit: input.purchaseUnit,
      baseUnit: input.baseUnit,
      taxIncluded: input.taxIncluded ?? true,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
    },
    include: { category: { select: { name: true } } },
  });
  return toIngredientRow(row);
}

export async function updateIngredient(
  id: string,
  input: UpdateIngredientInput
): Promise<IngredientRow> {
  const data: Prisma.IngredientUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.purchasePrice !== undefined) data.purchasePrice = String(input.purchasePrice);
  if (input.purchaseQuantity !== undefined) data.purchaseQuantity = String(input.purchaseQuantity);
  if (input.purchaseUnit !== undefined) data.purchaseUnit = input.purchaseUnit;
  if (input.baseUnit !== undefined) data.baseUnit = input.baseUnit;
  if (input.taxIncluded !== undefined) data.taxIncluded = input.taxIncluded;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.notes !== undefined) data.notes = input.notes;
  if ("categoryId" in input) {
    data.category = input.categoryId
      ? { connect: { id: input.categoryId } }
      : { disconnect: true };
  }

  const row = await prisma.ingredient.update({
    where: { id },
    data,
    include: { category: { select: { name: true } } },
  });
  return toIngredientRow(row);
}

export async function archiveIngredient(id: string): Promise<IngredientRow> {
  const row = await prisma.ingredient.update({
    where: { id },
    data: { isActive: false },
    include: { category: { select: { name: true } } },
  });
  return toIngredientRow(row);
}
