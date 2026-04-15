export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { listIngredients } from "@/lib/services/ingredientService";
import { getIngredientImpactOnRecipes } from "@/lib/services/costingAnalysisService";

type SearchParams = {
  ingredientId?: string;
};

function fmtDelta(val: number | null, prefix = "$"): string {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${prefix}${val.toFixed(4)}`;
}

function fmtPct(val: number | null): string {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

export default async function CostImpactPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const selectedIngredientId = sp.ingredientId ?? null;

  const ingredients = await listIngredients({ isActive: true });

  let impactRows = null;
  let selectedIngredientName: string | null = null;
  if (selectedIngredientId) {
    const found = ingredients.find((i) => i.id === selectedIngredientId);
    selectedIngredientName = found?.name ?? null;
    impactRows = await getIngredientImpactOnRecipes(selectedIngredientId);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/costing/dashboard" className="hover:text-amber-600 transition-colors">Costing Dashboard</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Cost Impact</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Ingredient Cost Impact</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Select an ingredient to see how its price change affects product costs and margins.
        </p>
      </div>

      {/* Ingredient selector */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <label htmlFor="ingredient-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Ingredient
        </label>
        <form method="get" className="flex items-center gap-3">
          <select
            id="ingredient-select"
            name="ingredientId"
            defaultValue={selectedIngredientId ?? ""}
            className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">— Choose an ingredient —</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-md hover:bg-amber-600 transition-colors"
          >
            Analyze
          </button>
        </form>
      </section>

      {/* Results */}
      {impactRows !== null && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Impact of &ldquo;{selectedIngredientName}&rdquo; Price Change on Products
          </h2>

          {impactRows.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
              <p>This ingredient is not used in any active recipes.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Usage Qty</th>
                    <th className="px-4 py-3">Prev Contribution</th>
                    <th className="px-4 py-3">Curr Contribution</th>
                    <th className="px-4 py-3">Contribution Δ</th>
                    <th className="px-4 py-3">Prev Cost/Unit</th>
                    <th className="px-4 py-3">Curr Cost/Unit</th>
                    <th className="px-4 py-3">Cost Δ/Unit</th>
                    <th className="px-4 py-3">Margin Effect</th>
                    <th className="px-4 py-3">Rec. Price Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {impactRows.map((row) => (
                    <tr key={row.productId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link
                          href={`/products/${row.productId}/recipe`}
                          className="hover:text-amber-600"
                        >
                          {row.productName}
                        </Link>
                        {row.sellingPrice !== null && (
                          <span className="ml-1 text-xs text-gray-400">
                            (${row.sellingPrice.toFixed(2)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {row.ingredientQuantity.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono">
                        {row.previousContribution !== null
                          ? `$${row.previousContribution.toFixed(4)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono">
                        {row.currentContribution !== null
                          ? `$${row.currentContribution.toFixed(4)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {row.contributionDelta !== null ? (
                          <span
                            className={
                              row.contributionDelta > 0
                                ? "text-red-600 font-semibold"
                                : row.contributionDelta < 0
                                ? "text-green-600 font-semibold"
                                : "text-gray-500"
                            }
                          >
                            {fmtDelta(row.contributionDelta)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono">
                        {row.previousCostPerUnit !== null
                          ? `$${row.previousCostPerUnit.toFixed(4)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono">
                        {row.currentCostPerUnit !== null
                          ? `$${row.currentCostPerUnit.toFixed(4)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {row.costDelta !== null ? (
                          <span
                            className={
                              row.costDelta > 0
                                ? "text-red-600 font-semibold"
                                : row.costDelta < 0
                                ? "text-green-600 font-semibold"
                                : "text-gray-500"
                            }
                          >
                            {fmtDelta(row.costDelta)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.marginEffect !== null ? (
                          <span
                            className={
                              row.marginEffect < 0
                                ? "text-red-600 font-semibold"
                                : row.marginEffect > 0
                                ? "text-green-600"
                                : "text-gray-500"
                            }
                          >
                            {fmtPct(row.marginEffect)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No selling price</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.recommendedPriceDelta !== null ? (
                          <span
                            className={
                              row.recommendedPriceDelta > 0
                                ? "text-amber-600 font-semibold"
                                : "text-green-600"
                            }
                          >
                            {fmtDelta(row.recommendedPriceDelta)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No target</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {impactRows === null && (
        <div className="bg-white border border-dashed border-gray-200 rounded-lg p-12 text-center text-gray-400">
          <p className="text-base">Select an ingredient above to analyze its cost impact.</p>
        </div>
      )}
    </div>
  );
}
