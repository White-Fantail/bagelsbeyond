import "server-only";
import { prisma } from "@/lib/db";
import { PricingTargetType } from "@/app/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductCategoryRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductCategoryInput = {
  name: string;
  slug: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateProductCategoryInput = Partial<CreateProductCategoryInput>;

export type MenuProductRow = {
  id: string;
  name: string;
  sku: string | null;
  isActive: boolean;
  notes: string | null;
  sellingPrice: string | null;
  pricingTargetType: PricingTargetType | null;
  pricingTargetPercent: string | null;
  canBeUsedAsRecipeComponent: boolean;
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMenuProductInput = {
  name: string;
  sku?: string | null;
  isActive?: boolean;
  notes?: string | null;
  sellingPrice?: number | null;
  pricingTargetType?: PricingTargetType | null;
  pricingTargetPercent?: number | null;
  canBeUsedAsRecipeComponent?: boolean;
  categoryId?: string | null;
};

export type UpdateMenuProductInput = Partial<CreateMenuProductInput>;

// ─── Product Categories ───────────────────────────────────────────────────────

export async function listProductCategories(): Promise<ProductCategoryRow[]> {
  const rows = await prisma.productCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createProductCategory(
  input: CreateProductCategoryInput
): Promise<ProductCategoryRow> {
  const row = await prisma.productCategory.create({
    data: {
      name: input.name,
      slug: input.slug,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function updateProductCategory(
  id: string,
  input: UpdateProductCategoryInput
): Promise<ProductCategoryRow> {
  const row = await prisma.productCategory.update({
    where: { id },
    data: input,
  });
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function toMenuProductRow(r: {
  id: string;
  name: string;
  sku: string | null;
  isActive: boolean;
  notes: string | null;
  sellingPrice: { toString(): string } | null;
  pricingTargetType: PricingTargetType | null;
  pricingTargetPercent: { toString(): string } | null;
  canBeUsedAsRecipeComponent: boolean;
  categoryId: string | null;
  category?: { name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}): MenuProductRow {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    isActive: r.isActive,
    notes: r.notes,
    sellingPrice: r.sellingPrice !== null ? r.sellingPrice.toString() : null,
    pricingTargetType: r.pricingTargetType,
    pricingTargetPercent: r.pricingTargetPercent !== null ? r.pricingTargetPercent.toString() : null,
    canBeUsedAsRecipeComponent: r.canBeUsedAsRecipeComponent,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listMenuProducts(filter: {
  search?: string;
  isActive?: boolean;
  categoryId?: string;
} = {}): Promise<MenuProductRow[]> {
  const where: Record<string, unknown> = {};
  if (filter.search) {
    where.name = { contains: filter.search, mode: "insensitive" };
  }
  if (filter.isActive !== undefined) {
    where.isActive = filter.isActive;
  }
  if (filter.categoryId === "none") {
    where.categoryId = null;
  } else if (filter.categoryId) {
    where.categoryId = filter.categoryId;
  }

  const rows = await prisma.menuProduct.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map(toMenuProductRow);
}

export async function getMenuProductById(id: string): Promise<MenuProductRow | null> {
  const row = await prisma.menuProduct.findUnique({
    where: { id },
    include: { category: { select: { name: true } } },
  });
  if (!row) return null;
  return toMenuProductRow(row);
}

export async function createMenuProduct(input: CreateMenuProductInput): Promise<MenuProductRow> {
  const row = await prisma.menuProduct.create({
    data: {
      name: input.name,
      sku: input.sku ?? null,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
      sellingPrice: input.sellingPrice != null ? String(input.sellingPrice) : null,
      pricingTargetType: input.pricingTargetType ?? null,
      pricingTargetPercent: input.pricingTargetPercent != null ? String(input.pricingTargetPercent) : null,
      canBeUsedAsRecipeComponent: input.canBeUsedAsRecipeComponent ?? false,
      categoryId: input.categoryId ?? null,
    },
    include: { category: { select: { name: true } } },
  });
  return toMenuProductRow(row);
}

export async function updateMenuProduct(
  id: string,
  input: UpdateMenuProductInput
): Promise<MenuProductRow> {
  const row = await prisma.menuProduct.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...("sku" in input ? { sku: input.sku ?? null } : {}),
      ...("sellingPrice" in input
        ? { sellingPrice: input.sellingPrice != null ? String(input.sellingPrice) : null }
        : {}),
      ...("pricingTargetType" in input ? { pricingTargetType: input.pricingTargetType ?? null } : {}),
      ...("pricingTargetPercent" in input
        ? { pricingTargetPercent: input.pricingTargetPercent != null ? String(input.pricingTargetPercent) : null }
        : {}),
      ...("canBeUsedAsRecipeComponent" in input
        ? { canBeUsedAsRecipeComponent: input.canBeUsedAsRecipeComponent ?? false }
        : {}),
      ...("categoryId" in input ? { categoryId: input.categoryId ?? null } : {}),
    },
    include: { category: { select: { name: true } } },
  });
  return toMenuProductRow(row);
}

/**
 * Returns all active products that can be used as recipe components.
 */
export async function listComponentProducts(): Promise<MenuProductRow[]> {
  const rows = await prisma.menuProduct.findMany({
    where: { canBeUsedAsRecipeComponent: true, isActive: true },
    include: { category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map(toMenuProductRow);
}
