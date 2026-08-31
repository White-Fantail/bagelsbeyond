export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listMenuProducts, listProductCategories } from "@/lib/services/menuProductService";
import Link from "next/link";
import { Suspense } from "react";
import ProductTable from "./ProductTable";
import ProductFilters from "./ProductFilters";

type SearchParams = {
  search?: string;
  isActive?: string;
  categoryId?: string;
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const isActive = sp.isActive === "true" ? true : sp.isActive === "false" ? false : undefined;
  const [products, categories] = await Promise.all([
    listMenuProducts({ search: sp.search?.trim(), isActive, categoryId: sp.categoryId }),
    listProductCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage products used by Freshness tracking.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/product-categories" className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium">Categories</Link>
          <Link href="/products/new" className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium">+ Add Product</Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Total</p><p className="text-2xl font-bold mt-1">{products.length}</p></div>
        <div className="bg-white rounded-xl border border-green-100 p-4"><p className="text-xs text-green-600">Active</p><p className="text-2xl font-bold text-green-700 mt-1">{products.filter((p) => p.isActive).length}</p></div>
      </div>
      <Suspense fallback={null}><ProductFilters categories={categories} /></Suspense>
      <ProductTable products={products} />
    </div>
  );
}
