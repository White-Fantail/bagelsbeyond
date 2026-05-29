import { notFound } from "next/navigation";
import OrderingPage from "./components/OrderingPage";

const STORE_SLUG = "bagels-beyond";

type Store = {
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

type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

type ModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: ModifierOption[];
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sellingPrice: number | null;
  isPopular: boolean;
  isSoldOut: boolean;
  modifierGroups: ModifierGroup[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  products: Product[];
};

type MenuData = {
  store: Store;
  categories: Category[];
};

async function getMenu(): Promise<MenuData | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/public/stores/${STORE_SLUG}/menu`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch menu:", error);
    return null;
  }
}

export default async function OrderPage() {
  const menuData = await getMenu();

  if (!menuData) {
    notFound();
  }

  return <OrderingPage initialData={menuData} storeSlug={STORE_SLUG} />;
}
