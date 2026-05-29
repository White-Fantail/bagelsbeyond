export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listMenuProducts, listProductCategories } from "@/lib/services/menuProductService";
import { getProductRecipeSummaries } from "@/lib/services/recipeService";
import { getGlobalPricingSettings, buildPricingSummaryForProduct } from "@/lib/services/pricingService";
import Link from "next/link";
import { Suspense } from "react";
import ProductTable from "./ProductTable";
import ProductFilters from "./ProductFilters";

type SearchParams = {
  search?: string;
  isActive?: string;
  categoryId?: string;
  loyverseLink?: string;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const isActiveFilter =
    sp.isActive === "true" ? true : sp.isActive === "false" ? false : undefined;

  const [products, globalPricingSettings, categories] = await Promise.all([
    listMenuProducts({
      search: sp.search?.trim(),
      isActive: isActiveFilter,
      categoryId: sp.categoryId,
      loyverseLink:
        sp.loyverseLink === "linked" || sp.loyverseLink === "internal"
          ? sp.loyverseLink
          : undefined,
    }),
    getGlobalPricingSettings(),
    listProductCategories(),
  ]);

  const productIds = products.map((p) => p.id);
  const recipeSummaries = await getProductRecipeSummaries(productIds);

  // Build pricing summary for each product
  const pricingSummaries = new Map(
    products.map((product) => {
      const recipeSummary = recipeSummaries.get(product.id);
      // Use per-unit cost for pricing (not batch total)
      const adjustedCost =
        recipeSummary?.adjustedCostPerOutputUnit != null
          ? parseFloat(recipeSummary.adjustedCostPerOutputUnit)
          : null;
      const summary = buildPricingSummaryForProduct(product, adjustedCost, globalPricingSettings);
      return [product.id, summary];
    })
  );

  const hasFilters = !!(sp.search || sp.categoryId || sp.isActive || sp.loyverseLink);
  const activeCount = products.filter((p) => p.isActive).length;
  const withRecipeCount = [...recipeSummaries.values()].filter((s) => s.hasActiveRecipe).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Products</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Manage menu products and their recipe costs
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/product-categories"
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Categories
          </Link>
          <Link
            href="/products/new"
            className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            + Add Product
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">Active</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-4">
          <p className="text-xs text-amber-600">With Recipe</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{withRecipeCount}</p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <ProductFilters categories={categories} />
      </Suspense>

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {hasFilters ? (
            <>
              Search results <strong className="text-gray-700">{products.length}</strong>
            </>
          ) : (
            <>
              All <strong className="text-gray-700">{products.length}</strong>
            </>
          )}
        </span>
      </div>

      {/* Table */}
      <ProductTable products={products} recipeSummaries={recipeSummaries} pricingSummaries={pricingSummaries} />
    </div>
  );
}
