import "server-only";
import { prisma } from "@/lib/db";

export type CategoryWithMapping = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sourceChannel: string | null;
  sourceRef: string | null;
  syncedAt: string | null;
  mappingStatus: string | null;
};

export async function listCategories(search?: string): Promise<CategoryWithMapping[]> {
  const where = search
    ? { isActive: true, name: { contains: search, mode: "insensitive" as const } }
    : { isActive: true };

  const rows = await prisma.category.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      sortOrder: true,
      isVisible: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      categoryChannelMappings: {
        where: { isPrimary: true },
        take: 1,
        select: {
          channel: true,
          mappingStatus: true,
          channelCategory: {
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
    const mapping = row.categoryChannelMappings[0] ?? null;
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      sortOrder: row.sortOrder,
      isVisible: row.isVisible,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sourceChannel: mapping?.channel ?? null,
      sourceRef: mapping?.channelCategory?.externalId ?? null,
      syncedAt: mapping?.channelCategory?.syncedAt?.toISOString() ?? null,
      mappingStatus: mapping?.mappingStatus ?? null,
    };
  });
}
