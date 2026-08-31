"use client";

import Link from "next/link";
import type { MenuProductRow } from "@/lib/services/menuProductService";
import type { ProductRecipeSummary } from "@/lib/services/recipeService";
import type { ProductPricingSummary } from "@/lib/costing/pricing";
import PricingStatusBadge from "@/components/PricingStatusBadge";

interface ProductTableProps {
  products: MenuProductRow[];
  recipeSummaries: Map<string, ProductRecipeSummary>;
  pricingSummaries: Map<string, ProductPricingSummary>;
}

export default function ProductTable({ products, recipeSummaries, pricingSummaries }: ProductTableProps) {
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
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Loyverse</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Recipe</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Adj. Cost</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Selling Price</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cost %</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Recommended</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((product) => {
                const summary = recipeSummaries.get(product.id);
                const pricing = pricingSummaries.get(product.id);
                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/products/${product.id}/edit`}
                        className="text-gray-900 hover:text-amber-700 hover:underline"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {product.categoryName ?? <span className="italic text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {product.sku ?? <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.loyverseId
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {product.loyverseId ? "Linked" : "Internal"}
                      </span>
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
                        <Link
                          href={`/products/${product.id}/recipe`}
                          aria-label={`${product.name} recipe`}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                        >
                          {summary.recipeName ?? "Recipe"}
                        </Link>
                      ) : (
                        <Link
                          href={`/products/${product.id}/recipe`}
                          aria-label={`Create recipe for ${product.name}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          No recipe
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {summary?.adjustedCostPerOutputUnit ? (
                        <span className="font-semibold text-gray-900">
                          ${summary.adjustedCostPerOutputUnit}
                          <span className="text-gray-400 font-normal">/{summary.outputUnit}</span>
                        </span>
                      ) : summary?.hasActiveRecipe ? (
                        <span className="text-amber-600 text-xs">Incomplete</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {pricing?.sellingPrice != null ? (
                        <span className="text-gray-900">${pricing.sellingPrice.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">No price</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {pricing?.actualCostPercent != null ? (
                        <span className="text-gray-700">{pricing.actualCostPercent.toFixed(1)}%</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {pricing?.recommendedPrice != null ? (
                        <span className="text-gray-700">${pricing.recommendedPrice.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pricing ? (
                        <PricingStatusBadge status={pricing.pricingStatus} />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/products/${product.id}/modifiers`}
                          className="text-xs px-3 py-1.5 rounded-md border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors"
                        >
                          Modifiers
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
          const pricing = pricingSummaries.get(product.id);
          return (
            <div key={product.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/products/${product.id}/edit`}
                    className="font-medium text-gray-900 hover:text-amber-700 hover:underline"
                  >
                    {product.name}
                  </Link>
                  {product.sku && (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{product.sku}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      product.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {product.isActive ? "Active" : "Inactive"}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.loyverseId
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {product.loyverseId ? "Linked" : "Internal"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {summary?.hasActiveRecipe ? (
                  <>
                    <Link
                      href={`/products/${product.id}/recipe`}
                      aria-label={`${product.name} recipe`}
                      className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                    >
                      {summary.recipeName ?? "Recipe"}
                    </Link>
                    <span className="text-gray-500">{summary.ingredientCount} items</span>
                    {summary.adjustedCostPerOutputUnit ? (
                      <span className="font-mono text-gray-600 ml-auto text-xs">
                        ${summary.adjustedCostPerOutputUnit}/{summary.outputUnit}
                      </span>
                    ) : (
                      <span className="text-amber-600 ml-auto">Incomplete costing</span>
                    )}
                  </>
                ) : (
                  <Link
                    href={`/products/${product.id}/recipe`}
                    aria-label={`Create recipe for ${product.name}`}
                    className="text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    No recipe
                  </Link>
                )}
              </div>
              {pricing && (
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="text-gray-500">
                    {pricing.sellingPrice != null
                      ? `Price: $${pricing.sellingPrice.toFixed(2)}`
                      : "No selling price"}
                  </span>
                  {pricing.actualCostPercent != null && (
                    <span className="text-gray-500">Cost: {pricing.actualCostPercent.toFixed(1)}%</span>
                  )}
                  {pricing.recommendedPrice != null && (
                    <span className="text-gray-500">Rec: ${pricing.recommendedPrice.toFixed(2)}</span>
                  )}
                  <PricingStatusBadge status={pricing.pricingStatus} />
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/products/${product.id}/modifiers`}
                  className="text-xs px-3 py-1.5 rounded-md border border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  Modifiers
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
