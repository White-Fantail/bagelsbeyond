export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listIngredients, listIngredientCategories } from "@/lib/services/ingredientService";
import Link from "next/link";
import { Suspense } from "react";
import IngredientFilters from "./IngredientFilters";
import IngredientTable from "./IngredientTable";

type SearchParams = {
  search?: string;
  categoryId?: string;
  isActive?: string;
};

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const isActiveFilter =
    sp.isActive === "true" ? true : sp.isActive === "false" ? false : undefined;

  const [ingredients, categories] = await Promise.all([
    listIngredients({
      search: sp.search?.trim(),
      categoryId: sp.categoryId,
      isActive: isActiveFilter,
    }),
    listIngredientCategories(),
  ]);

  const hasFilters = !!(sp.search || sp.categoryId || sp.isActive);
  const activeCount = ingredients.filter((i) => i.isActive).length;
  const inactiveCount = ingredients.filter((i) => !i.isActive).length;

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
            <span className="text-gray-700 font-medium">Ingredients</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredients</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Manage ingredient master data for menu costing
          </p>
        </div>
        <Link
          href="/ingredients/new"
          className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors flex-shrink-0"
        >
          + Add Ingredient
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{ingredients.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">Active</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-500 mt-1">{inactiveCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-600">Categories</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{categories.length}</p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <IngredientFilters categories={categories} />
      </Suspense>

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {hasFilters ? (
            <>
              Search results <strong className="text-gray-700">{ingredients.length}</strong>
            </>
          ) : (
            <>
              All <strong className="text-gray-700">{ingredients.length}</strong>
            </>
          )}
        </span>
      </div>

      {/* Table */}
      <IngredientTable ingredients={ingredients} />
    </div>
  );
}
