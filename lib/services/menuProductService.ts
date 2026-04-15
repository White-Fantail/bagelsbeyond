import "server-only";
import { prisma } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MenuProductRow = {
  id: string;
  name: string;
  sku: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMenuProductInput = {
  name: string;
  sku?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

export type UpdateMenuProductInput = Partial<CreateMenuProductInput>;

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function toMenuProductRow(r: {
  id: string;
  name: string;
  sku: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MenuProductRow {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    isActive: r.isActive,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listMenuProducts(filter: {
  search?: string;
  isActive?: boolean;
} = {}): Promise<MenuProductRow[]> {
  const rows = await prisma.menuProduct.findMany({
    where: {
      ...(filter.search ? { name: { contains: filter.search, mode: "insensitive" } } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
    },
    orderBy: { name: "asc" },
  });
  return rows.map(toMenuProductRow);
}

export async function getMenuProductById(id: string): Promise<MenuProductRow | null> {
  const row = await prisma.menuProduct.findUnique({ where: { id } });
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
    },
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
    },
  });
  return toMenuProductRow(row);
}
