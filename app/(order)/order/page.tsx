export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import OrderingPage from "./components/OrderingPage";

const STORE_SLUG = "bagels-beyond";

export type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

export type ModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: ModifierOption[];
};

export type OrderProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sellingPrice: number | null;
  isPopular: boolean;
  isSoldOut: boolean;
  modifierGroups: ModifierGroup[];
};

export type OrderCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  products: OrderProduct[];
};

export type OrderStore = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  suburb: string | null;
  city: string | null;
  phone: string | null;
  bannerImageUrl: string | null;
  logoImageUrl: string | null;
  isOpen: boolean;
};

export type MenuData = {
  store: OrderStore;
  categories: OrderCategory[];
};

async function getMenuData(): Promise<MenuData | null> {
  // Find or auto-create the store record
  let store = await prisma.store.findUnique({ where: { slug: STORE_SLUG } });

  if (!store) {
    const appSetting = await prisma.appSetting.findFirst();
    try {
      store = await prisma.store.create({
        data: {
          slug: STORE_SLUG,
          name: appSetting?.shopName ?? "Bagel's Beyond",
          city: appSetting?.defaultCity ?? "Christchurch",
          isOpen: true,
        },
      });
    } catch (err) {
      // Race condition: another request already created the store row — safe to ignore
      console.warn("Store auto-create race condition (already exists):", err);
      store = await prisma.store.findUnique({ where: { slug: STORE_SLUG } });
    }
  }

  if (!store) return null;

  const dbCategories = await prisma.productCategory.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      products: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          sellingPrice: true,
          isPopular: true,
          isSoldOut: true,
          modifierGroups: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
              isRequired: true,
              minSelections: true,
              maxSelections: true,
              sortOrder: true,
              options: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: { id: true, name: true, priceDelta: true, sortOrder: true },
              },
            },
          },
        },
        orderBy: [{ isPopular: "desc" }, { name: "asc" }],
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const categories: OrderCategory[] = dbCategories
    .filter((cat) => cat.products.length > 0)
    .map((cat) => ({
      ...cat,
      products: cat.products.map((prod) => ({
        ...prod,
        sellingPrice: prod.sellingPrice ? Number(prod.sellingPrice) : null,
        modifierGroups: prod.modifierGroups.map((grp) => ({
          ...grp,
          options: grp.options.map((opt) => ({
            ...opt,
            priceDelta: Number(opt.priceDelta),
          })),
        })),
      })),
    }));

  return {
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      address: store.address,
      suburb: store.suburb,
      city: store.city,
      phone: store.phone,
      bannerImageUrl: store.bannerImageUrl,
      logoImageUrl: store.logoImageUrl,
      isOpen: store.isOpen,
    },
    categories,
  };
}

export default async function OrderPage() {
  const menuData = await getMenuData();

  if (!menuData) {
    notFound();
  }

  return <OrderingPage initialData={menuData} storeSlug={STORE_SLUG} />;
}
