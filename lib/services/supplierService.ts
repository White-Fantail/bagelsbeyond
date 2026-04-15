import "server-only";
import { prisma } from "@/lib/db";
import { SupplierIntegrationType, SupplierSyncMode, UnitType } from "@/app/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupplierRow = {
  id: string;
  name: string;
  slug: string;
  integrationType: SupplierIntegrationType;
  websiteUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  linkedIngredientCount: number;
};

export type SupplierUsageSummary = {
  supplierId: string;
  supplierName: string;
  ingredientCount: number;
  primaryLinkCount: number;
};

export type IngredientSupplierLinkRow = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  supplierId: string;
  supplierName: string;
  supplierProductName: string;
  supplierProductCode: string | null;
  supplierProductUrl: string | null;
  supplierPackageQuantity: string | null;
  supplierPackageUnit: UnitType | null;
  supplierBaseUnit: UnitType | null;
  isPrimary: boolean;
  isActive: boolean;
  syncMode: SupplierSyncMode;
  lastCheckedAt: string | null;
  lastSyncStatus: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IngredientSupplierSummary = {
  ingredientId: string;
  ingredientName: string;
  primarySupplierName: string | null;
  supplierLinkCount: number;
  links: IngredientSupplierLinkRow[];
};

// ─── Input types ──────────────────────────────────────────────────────────────

export type CreateSupplierInput = {
  name: string;
  slug: string;
  integrationType?: SupplierIntegrationType;
  websiteUrl?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export type CreateIngredientSupplierLinkInput = {
  ingredientId: string;
  supplierId: string;
  supplierProductName: string;
  supplierProductCode?: string | null;
  supplierProductUrl?: string | null;
  supplierPackageQuantity?: number | null;
  supplierPackageUnit?: UnitType | null;
  supplierBaseUnit?: UnitType | null;
  isPrimary?: boolean;
  isActive?: boolean;
  syncMode?: SupplierSyncMode;
  notes?: string | null;
};

export type UpdateIngredientSupplierLinkInput = Partial<Omit<CreateIngredientSupplierLinkInput, "ingredientId" | "supplierId">>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSupplierRow(
  r: {
    id: string;
    name: string;
    slug: string;
    integrationType: SupplierIntegrationType;
    websiteUrl: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count?: { ingredientLinks: number };
  }
): SupplierRow {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    integrationType: r.integrationType,
    websiteUrl: r.websiteUrl,
    notes: r.notes,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    linkedIngredientCount: r._count?.ingredientLinks ?? 0,
  };
}

function toLinkRow(r: {
  id: string;
  ingredientId: string;
  supplierId: string;
  supplierProductName: string;
  supplierProductCode: string | null;
  supplierProductUrl: string | null;
  supplierPackageQuantity: { toString(): string } | null;
  supplierPackageUnit: UnitType | null;
  supplierBaseUnit: UnitType | null;
  isPrimary: boolean;
  isActive: boolean;
  syncMode: SupplierSyncMode;
  lastCheckedAt: Date | null;
  lastSyncStatus: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  ingredient: { name: string };
  supplier: { name: string };
}): IngredientSupplierLinkRow {
  return {
    id: r.id,
    ingredientId: r.ingredientId,
    ingredientName: r.ingredient.name,
    supplierId: r.supplierId,
    supplierName: r.supplier.name,
    supplierProductName: r.supplierProductName,
    supplierProductCode: r.supplierProductCode,
    supplierProductUrl: r.supplierProductUrl,
    supplierPackageQuantity: r.supplierPackageQuantity ? r.supplierPackageQuantity.toString() : null,
    supplierPackageUnit: r.supplierPackageUnit,
    supplierBaseUnit: r.supplierBaseUnit,
    isPrimary: r.isPrimary,
    isActive: r.isActive,
    syncMode: r.syncMode,
    lastCheckedAt: r.lastCheckedAt ? r.lastCheckedAt.toISOString() : null,
    lastSyncStatus: r.lastSyncStatus,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const LINK_INCLUDE = {
  ingredient: { select: { name: true } },
  supplier: { select: { name: true } },
} as const;

// ─── Supplier CRUD ────────────────────────────────────────────────────────────

export async function listSuppliers(): Promise<SupplierRow[]> {
  const rows = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { ingredientLinks: { where: { isActive: true } } } },
    },
  });
  return rows.map(toSupplierRow);
}

export async function getSupplierById(id: string): Promise<SupplierRow | null> {
  const row = await prisma.supplier.findUnique({
    where: { id },
    include: {
      _count: { select: { ingredientLinks: { where: { isActive: true } } } },
    },
  });
  if (!row) return null;
  return toSupplierRow(row);
}

export async function createSupplier(input: CreateSupplierInput): Promise<SupplierRow> {
  const row = await prisma.supplier.create({
    data: {
      name: input.name,
      slug: input.slug,
      integrationType: input.integrationType ?? SupplierIntegrationType.MANUAL,
      websiteUrl: input.websiteUrl ?? null,
      notes: input.notes ?? null,
      isActive: input.isActive ?? true,
    },
    include: {
      _count: { select: { ingredientLinks: { where: { isActive: true } } } },
    },
  });
  return toSupplierRow(row);
}

export async function updateSupplier(id: string, input: UpdateSupplierInput): Promise<SupplierRow> {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.integrationType !== undefined) data.integrationType = input.integrationType;
  if (input.websiteUrl !== undefined) data.websiteUrl = input.websiteUrl;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const row = await prisma.supplier.update({
    where: { id },
    data,
    include: {
      _count: { select: { ingredientLinks: { where: { isActive: true } } } },
    },
  });
  return toSupplierRow(row);
}

export async function archiveSupplier(id: string): Promise<SupplierRow> {
  const row = await prisma.supplier.update({
    where: { id },
    data: { isActive: false },
    include: {
      _count: { select: { ingredientLinks: { where: { isActive: true } } } },
    },
  });
  return toSupplierRow(row);
}

// ─── IngredientSupplierLink CRUD ──────────────────────────────────────────────

export async function listIngredientSupplierLinks(ingredientId: string): Promise<IngredientSupplierLinkRow[]> {
  const rows = await prisma.ingredientSupplierLink.findMany({
    where: { ingredientId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    include: LINK_INCLUDE,
  });
  return rows.map(toLinkRow);
}

export async function getIngredientSupplierLinkById(id: string): Promise<IngredientSupplierLinkRow | null> {
  const row = await prisma.ingredientSupplierLink.findUnique({
    where: { id },
    include: LINK_INCLUDE,
  });
  if (!row) return null;
  return toLinkRow(row);
}

export async function createIngredientSupplierLink(
  input: CreateIngredientSupplierLinkInput
): Promise<IngredientSupplierLinkRow> {
  if (input.supplierPackageQuantity !== undefined && input.supplierPackageQuantity !== null) {
    if (input.supplierPackageQuantity <= 0) {
      throw new Error("Package quantity must be greater than 0");
    }
  }

  if (input.supplierProductCode) {
    const existing = await prisma.ingredientSupplierLink.findFirst({
      where: {
        ingredientId: input.ingredientId,
        supplierId: input.supplierId,
        supplierProductCode: input.supplierProductCode,
        isActive: true,
      },
    });
    if (existing) {
      throw new Error(
        "An active link already exists for this ingredient, supplier, and product code"
      );
    }
  } else {
    const existing = await prisma.ingredientSupplierLink.findFirst({
      where: {
        ingredientId: input.ingredientId,
        supplierId: input.supplierId,
        supplierProductName: input.supplierProductName,
        isActive: true,
      },
    });
    if (existing) {
      throw new Error(
        "An active link already exists for this ingredient, supplier, and product name"
      );
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.ingredientSupplierLink.updateMany({
        where: { ingredientId: input.ingredientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return tx.ingredientSupplierLink.create({
      data: {
        ingredientId: input.ingredientId,
        supplierId: input.supplierId,
        supplierProductName: input.supplierProductName,
        supplierProductCode: input.supplierProductCode ?? null,
        supplierProductUrl: input.supplierProductUrl ?? null,
        supplierPackageQuantity:
          input.supplierPackageQuantity != null ? String(input.supplierPackageQuantity) : null,
        supplierPackageUnit: input.supplierPackageUnit ?? null,
        supplierBaseUnit: input.supplierBaseUnit ?? null,
        isPrimary: input.isPrimary ?? false,
        isActive: input.isActive ?? true,
        syncMode: input.syncMode ?? SupplierSyncMode.MANUAL_ONLY,
        notes: input.notes ?? null,
      },
      include: LINK_INCLUDE,
    });
  });

  return toLinkRow(row);
}

export async function updateIngredientSupplierLink(
  id: string,
  input: UpdateIngredientSupplierLinkInput
): Promise<IngredientSupplierLinkRow> {
  if (
    input.supplierPackageQuantity !== undefined &&
    input.supplierPackageQuantity !== null &&
    input.supplierPackageQuantity <= 0
  ) {
    throw new Error("Package quantity must be greater than 0");
  }

  const existing = await prisma.ingredientSupplierLink.findUnique({ where: { id } });
  if (!existing) throw new Error(`Link ${id} not found`);

  const data: Record<string, unknown> = {};
  if (input.supplierProductName !== undefined) data.supplierProductName = input.supplierProductName;
  if (input.supplierProductCode !== undefined) data.supplierProductCode = input.supplierProductCode;
  if (input.supplierProductUrl !== undefined) data.supplierProductUrl = input.supplierProductUrl;
  if (input.supplierPackageQuantity !== undefined)
    data.supplierPackageQuantity =
      input.supplierPackageQuantity != null ? String(input.supplierPackageQuantity) : null;
  if (input.supplierPackageUnit !== undefined) data.supplierPackageUnit = input.supplierPackageUnit;
  if (input.supplierBaseUnit !== undefined) data.supplierBaseUnit = input.supplierBaseUnit;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.syncMode !== undefined) data.syncMode = input.syncMode;
  if (input.notes !== undefined) data.notes = input.notes;

  if (input.isPrimary === true) {
    const row = await prisma.$transaction(async (tx) => {
      await tx.ingredientSupplierLink.updateMany({
        where: { ingredientId: existing.ingredientId, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
      return tx.ingredientSupplierLink.update({
        where: { id },
        data: { ...data, isPrimary: true },
        include: LINK_INCLUDE,
      });
    });
    return toLinkRow(row);
  }

  if (input.isPrimary !== undefined) data.isPrimary = input.isPrimary;

  const row = await prisma.ingredientSupplierLink.update({
    where: { id },
    data,
    include: LINK_INCLUDE,
  });
  return toLinkRow(row);
}

export async function archiveIngredientSupplierLink(id: string): Promise<IngredientSupplierLinkRow> {
  const row = await prisma.ingredientSupplierLink.update({
    where: { id },
    data: { isActive: false },
    include: LINK_INCLUDE,
  });
  return toLinkRow(row);
}

export async function setPrimaryIngredientSupplierLink(id: string): Promise<IngredientSupplierLinkRow> {
  const existing = await prisma.ingredientSupplierLink.findUnique({ where: { id } });
  if (!existing) throw new Error(`Link ${id} not found`);

  const row = await prisma.$transaction(async (tx) => {
    await tx.ingredientSupplierLink.updateMany({
      where: { ingredientId: existing.ingredientId, isPrimary: true },
      data: { isPrimary: false },
    });
    return tx.ingredientSupplierLink.update({
      where: { id },
      data: { isPrimary: true },
      include: LINK_INCLUDE,
    });
  });
  return toLinkRow(row);
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

export async function getIngredientSupplierSummary(
  ingredientId: string
): Promise<IngredientSupplierSummary | null> {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    include: {
      supplierLinks: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        include: LINK_INCLUDE,
      },
    },
  });
  if (!ingredient) return null;

  const primaryLink = ingredient.supplierLinks.find((l) => l.isPrimary && l.isActive);

  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    primarySupplierName: primaryLink?.supplier.name ?? null,
    supplierLinkCount: ingredient.supplierLinks.filter((l) => l.isActive).length,
    links: ingredient.supplierLinks.map(toLinkRow),
  };
}

export async function getSupplierUsageSummary(): Promise<SupplierUsageSummary[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    include: {
      ingredientLinks: {
        where: { isActive: true },
        select: { ingredientId: true, isPrimary: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return suppliers.map((s) => ({
    supplierId: s.id,
    supplierName: s.name,
    ingredientCount: new Set(s.ingredientLinks.map((l) => l.ingredientId)).size,
    primaryLinkCount: s.ingredientLinks.filter((l) => l.isPrimary).length,
  }));
}
