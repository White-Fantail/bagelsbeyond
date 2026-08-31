export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listProductCategories } from "@/lib/services/menuProductService";
import Link from "next/link";
import ProductCategoriesManager from "./ProductCategoriesManager";

export default async function ProductCategoriesPage() {
  await requireAdmin();
  const categories = await listProductCategories();

  return (
    <div className="space-y-6 w-full">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-amber-600 transition-colors">
            Products
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Categories</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Product Categories</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Manage product categories for organisation
        </p>
      </div>

      <ProductCategoriesManager initialCategories={categories} />
    </div>
  );
}
