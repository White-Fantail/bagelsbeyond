"use client";

import Link from "next/link";
import type { MenuProductRow } from "@/lib/services/menuProductService";
import type { ProductRecipeSummary } from "@/lib/services/recipeService";

interface ProductTableProps {
  products: MenuProductRow[];
  recipeSummaries: Map<string, ProductRecipeSummary>;
}

export default function ProductTable({ products, recipeSummaries }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">No products found.</p>
        <p className="text-gray-400 text-xs mt-1">
          <Link href="/products/new" className="text-amber-600 hover:underline">
            Add the first product
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Recipe</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Ingredients</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Direct Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Adjusted Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((product) => {
              const summary = recipeSummaries.get(product.id);
              return (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                    {product.sku ?? <span className="italic text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        product.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {summary?.hasActiveRecipe ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {summary.recipeName ?? "Recipe"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                        No recipe
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {summary?.hasActiveRecipe ? summary.ingredientCount : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 text-xs">
                    {summary?.directTotalCost ? (
                      `$${summary.directTotalCost}`
                    ) : summary?.hasActiveRecipe ? (
                      <span className="text-amber-600 text-xs">Incomplete</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {summary?.adjustedTotalCost ? (
                      <span className="font-semibold text-gray-900">${summary.adjustedTotalCost}</span>
                    ) : summary?.hasActiveRecipe ? (
                      <span className="text-amber-600 text-xs">Incomplete</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/products/${product.id}/recipe`}
                        className="text-xs px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
                      >
                        Recipe
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-gray-100">
        {products.map((product) => {
          const summary = recipeSummaries.get(product.id);
          return (
            <div key={product.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  {product.sku && (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{product.sku}</p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    product.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {product.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {summary?.hasActiveRecipe ? (
                  <>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                      {summary.recipeName ?? "Recipe"}
                    </span>
                    <span className="text-gray-500">{summary.ingredientCount} ingredients</span>
                    {summary.directTotalCost ? (
                      <span className="font-mono text-gray-600 ml-auto text-xs">
                        <span className="text-gray-400">Direct </span>${summary.directTotalCost}
                        {summary.adjustedTotalCost && summary.adjustedTotalCost !== summary.directTotalCost && (
                          <span className="ml-1 font-semibold text-gray-900">
                            → ${summary.adjustedTotalCost}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-amber-600 ml-auto">Incomplete costing</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400">No recipe yet</span>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/products/${product.id}/recipe`}
                  className="text-xs px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  Manage Recipe
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
