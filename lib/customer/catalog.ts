import "server-only";
import { prisma } from "@/lib/db";

export interface CustomerCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface CustomerModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface CustomerModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  options: CustomerModifierOption[];
}

export interface CustomerMenuItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  sortOrder: number;
  categoryId: string | null;
  isAvailable: boolean;
  isSubscribable: boolean;
  modifierGroups: CustomerModifierGroup[];
}

export async function getCustomerCategories(): Promise<CustomerCategory[]> {
  const cats = await prisma.category.findMany({
    where: { isActive: true, isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, sortOrder: true },
  });
  return cats;
}

export async function getCustomerMenuItems(categoryId?: string): Promise<CustomerMenuItem[]> {
  const items = await prisma.item.findMany({
    where: {
      isActive: true,
      isVisible: true,
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      basePrice: true,
      imageUrl: true,
      sortOrder: true,
      categoryId: true,
      itemModifierGroups: {
        where: { modifierGroup: { isActive: true } },
        orderBy: { sortOrder: "asc" },
        select: {
          isRequired: true,
          modifierGroup: {
            select: {
              id: true,
              name: true,
              minSelect: true,
              maxSelect: true,
              modifierOptions: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: { id: true, name: true, priceDelta: true, isDefault: true },
              },
            },
          },
        },
      },
    },
  });

  return items.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    basePrice: Number(item.basePrice ?? 0),
    imageUrl: item.imageUrl,
    sortOrder: item.sortOrder,
    categoryId: item.categoryId,
    isAvailable: true,
    isSubscribable: false,
    modifierGroups: item.itemModifierGroups.map(img => ({
      id: img.modifierGroup.id,
      name: img.modifierGroup.name,
      isRequired: img.isRequired,
      minSelect: img.modifierGroup.minSelect,
      maxSelect: img.modifierGroup.maxSelect,
      options: img.modifierGroup.modifierOptions.map(opt => ({
        id: opt.id,
        name: opt.name,
        priceDelta: Number(opt.priceDelta),
        isDefault: opt.isDefault,
      })),
    })),
  }));
}

export async function getSubscribableItems(): Promise<CustomerMenuItem[]> {
  const items = await getCustomerMenuItems();
  return items.map(item => ({ ...item, isSubscribable: true }));
}
