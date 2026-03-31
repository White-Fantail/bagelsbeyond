import "server-only";
import { prisma } from "@/lib/db";

export type ItemWithMapping = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  basePrice: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
  categoryId: string | null;
  categoryName: string | null;
  modifierGroupCount: number;
  createdAt: string;
  updatedAt: string;
  sourceChannel: string | null;
  sourceRef: string | null;
  syncedAt: string | null;
  mappingStatus: string | null;
};

export type ItemModifierGroupDetail = {
  id: string;
  name: string;
  minSelect: number | null;
  maxSelect: number | null;
  sortOrder: number;
  optionCount: number;
};

export async function listItems(opts?: {
  search?: string;
  categoryId?: string;
}): Promise<ItemWithMapping[]> {
  const where: {
    isActive: boolean;
    name?: { contains: string; mode: "insensitive" };
    categoryId?: string;
  } = { isActive: true };

  if (opts?.search) {
    where.name = { contains: opts.search, mode: "insensitive" };
  }
  if (opts?.categoryId) {
    where.categoryId = opts.categoryId;
  }

  const rows = await prisma.item.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      sku: true,
      basePrice: true,
      imageUrl: true,
      sortOrder: true,
      isVisible: true,
      isActive: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: { name: true },
      },
      itemModifierGroups: {
        select: { id: true },
      },
      itemChannelMappings: {
        where: { isPrimary: true },
        take: 1,
        select: {
          channel: true,
          mappingStatus: true,
          channelItem: {
            select: {
              externalId: true,
              syncedAt: true,
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const mapping = row.itemChannelMappings[0] ?? null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      sku: row.sku,
      basePrice: row.basePrice?.toString() ?? null,
      imageUrl: row.imageUrl,
      sortOrder: row.sortOrder,
      isVisible: row.isVisible,
      isActive: row.isActive,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      modifierGroupCount: row.itemModifierGroups.length,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sourceChannel: mapping?.channel ?? null,
      sourceRef: mapping?.channelItem?.externalId ?? null,
      syncedAt: mapping?.channelItem?.syncedAt?.toISOString() ?? null,
      mappingStatus: mapping?.mappingStatus ?? null,
    };
  });
}

export async function getItemModifierGroups(itemId: string): Promise<ItemModifierGroupDetail[]> {
  const links = await prisma.itemModifierGroup.findMany({
    where: { itemId },
    orderBy: { sortOrder: "asc" },
    select: {
      modifierGroup: {
        select: {
          id: true,
          name: true,
          minSelect: true,
          maxSelect: true,
          sortOrder: true,
          _count: {
            select: { modifierOptions: true },
          },
        },
      },
    },
  });

  return links.map((link) => ({
    id: link.modifierGroup.id,
    name: link.modifierGroup.name,
    minSelect: link.modifierGroup.minSelect,
    maxSelect: link.modifierGroup.maxSelect,
    sortOrder: link.modifierGroup.sortOrder,
    optionCount: link.modifierGroup._count.modifierOptions,
  }));
}
