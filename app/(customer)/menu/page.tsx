import { getCustomerCategories, getCustomerMenuItems } from "@/lib/customer/catalog";
import MenuClient from "./menu-client";

export default async function MenuPage() {
  const [categories, items] = await Promise.all([
    getCustomerCategories(),
    getCustomerMenuItems(),
  ]);
  return <MenuClient categories={categories} items={items} />;
}
