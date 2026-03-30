import "server-only";
import { prisma } from "@/lib/db";

export type ModifierOptionRow = {
  id: string;
  name: string;
  priceDelta: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  sourceRef: string | null;
};

export type ModifierGroupWithOptions = {
  id: string;
  name: string;
  description: string | null;
  minSelect: number | null;
  maxSelect: number | null;
  sortOrder: number;
  isActive: boolean;
  optionCount: number;
  linkedItemCount: number;
  createdAt: string;
  updatedAt: string;
  sourceChannel: string | null;
  sourceRef: string | null;
  syncedAt: string | null;
  mappingStatus: string | null;
  options: ModifierOptionRow[];
};

export async function listModifierGroups(search?: string): Promise<ModifierGroupWithOptions[]> {
  const where = search
    ? { isActive: true, name: { contains: search, mode: "insensitive" as const } }
    : { isActive: true };

  const rows = await prisma.modifierGroup.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      minSelect: true,
      maxSelect: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      modifierOptions: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          priceDelta: true,
          sortOrder: true,
          isDefault: true,
          isActive: true,
          modifierOptionChannelMappings: {
            where: { isPrimary: true },
            take: 1,
            select: {
              channelModifierOption: {
                select: { externalId: true },
              },
            },
          },
        },
      },
      itemModifierGroups: {
        select: { id: true },
      },
      modifierGroupChannelMappings: {
        where: { isPrimary: true },
        take: 1,
        select: {
          channel: true,
          mappingStatus: true,
          channelModifierGroup: {
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
    const mapping = row.modifierGroupChannelMappings[0] ?? null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      minSelect: row.minSelect,
      maxSelect: row.maxSelect,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      optionCount: row.modifierOptions.length,
      linkedItemCount: row.itemModifierGroups.length,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sourceChannel: mapping?.channel ?? null,
      sourceRef: mapping?.channelModifierGroup?.externalId ?? null,
      syncedAt: mapping?.channelModifierGroup?.syncedAt?.toISOString() ?? null,
      mappingStatus: mapping?.mappingStatus ?? null,
      options: row.modifierOptions.map((opt) => ({
        id: opt.id,
        name: opt.name,
        priceDelta: opt.priceDelta.toString(),
        sortOrder: opt.sortOrder,
        isDefault: opt.isDefault,
        isActive: opt.isActive,
        sourceRef:
          opt.modifierOptionChannelMappings[0]?.channelModifierOption?.externalId ?? null,
      })),
    };
  });
}
