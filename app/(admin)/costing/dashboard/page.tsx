export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import {
  getCostingDashboardSummary,
  getRecentIngredientPriceMovements,
} from "@/lib/services/costingAnalysisService";
import StatCard from "@/components/StatCard";

function fmt(value: number | null | undefined, prefix = "$"): string {
  if (value === null || value === undefined) return "—";
  return `${prefix}${Math.abs(value).toFixed(4)}`;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default async function CostingDashboardPage() {
  await requireAdmin();

  const [summary, movements] = await Promise.all([
    getCostingDashboardSummary(),
    getRecentIngredientPriceMovements({ limit: 8 }),
  ]);

  const { recentlyUpdated, biggestIncreases, biggestDecreases, staleIngredients } = movements;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Costing Dashboard</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Costing Dashboard</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Actionable overview of ingredient prices, supplier health, and product margins.
        </p>
      </div>

      {/* Summary Cards */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="Updated (7 days)"
            value={summary.ingredientsUpdatedLast7Days}
            sub="ingredients with recent price updates"
            color="blue"
          />
          <StatCard
            title="Biggest Increase"
            value={
              summary.biggestIncrease
                ? fmtPct(summary.biggestIncrease.priceDeltaPct)
                : "—"
            }
            sub={summary.biggestIncrease?.ingredientName ?? "No recent increases"}
            color="red"
          />
          <StatCard
            title="Biggest Decrease"
            value={
              summary.biggestDecrease
                ? fmtPct(summary.biggestDecrease.priceDeltaPct)
                : "—"
            }
            sub={summary.biggestDecrease?.ingredientName ?? "No recent decreases"}
            color="green"
          />
          <StatCard
            title="Below Target"
            value={summary.productsBelowTargetCount}
            sub="products below margin target"
            color={summary.productsBelowTargetCount > 0 ? "red" : "green"}
          />
          <StatCard
            title="Sync Issues"
            value={summary.supplierSyncIssueCount}
            sub="supplier links with stale or unavailable status"
            color={summary.supplierSyncIssueCount > 0 ? "amber" : "green"}
          />
          <StatCard
            title="Cheaper Alternates"
            value={summary.cheaperAlternateCount}
            sub="ingredients with a cheaper supplier available"
            color={summary.cheaperAlternateCount > 0 ? "blue" : "gray"}
          />
        </div>
      </section>

      {/* Quick links */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Analysis Pages</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/costing/pricing-health"
            className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-amber-400 transition-colors"
          >
            <p className="font-semibold text-gray-900">Pricing Health</p>
            <p className="text-sm text-gray-500 mt-1">
              Product margins, below-target detection, recommended price gaps
            </p>
          </Link>
          <Link
            href="/costing/impact"
            className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-amber-400 transition-colors"
          >
            <p className="font-semibold text-gray-900">Cost Impact</p>
            <p className="text-sm text-gray-500 mt-1">
              Trace ingredient price changes to affected products and margins
            </p>
          </Link>
          <Link
            href="/ingredients"
            className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-amber-400 transition-colors"
          >
            <p className="font-semibold text-gray-900">Supplier Comparison</p>
            <p className="text-sm text-gray-500 mt-1">
              Open an ingredient to compare linked supplier costs
            </p>
          </Link>
        </div>
      </section>

      {/* Recently Updated */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">Recently Updated Ingredients</h2>
          <span className="text-xs text-gray-400">Last 7 days</span>
        </div>
        {recentlyUpdated.length === 0 ? (
          <p className="text-sm text-gray-400">No ingredients updated in the last 7 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Ingredient</th>
                  <th className="pb-2 pr-4">Current Price</th>
                  <th className="pb-2 pr-4">Prev Price</th>
                  <th className="pb-2 pr-4">Price Δ</th>
                  <th className="pb-2 pr-4">Cost Δ%</th>
                  <th className="pb-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {recentlyUpdated.map((row) => (
                  <tr key={row.ingredientId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-900">{row.ingredientName}</td>
                    <td className="py-2 pr-4 text-gray-700">${row.currentPurchasePrice.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-gray-500">
                      {row.previousPurchasePrice !== null
                        ? `$${row.previousPurchasePrice.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {row.priceDelta !== null ? (
                        <span
                          className={
                            row.priceDelta > 0
                              ? "text-red-600"
                              : row.priceDelta < 0
                              ? "text-green-600"
                              : "text-gray-500"
                          }
                        >
                          {row.priceDelta > 0 ? "+" : ""}
                          {row.priceDelta.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">First entry</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {row.standardCostDeltaPct !== null ? (
                        <span
                          className={
                            row.standardCostDeltaPct > 0
                              ? "text-red-600"
                              : row.standardCostDeltaPct < 0
                              ? "text-green-600"
                              : "text-gray-500"
                          }
                        >
                          {fmtPct(row.standardCostDeltaPct)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-gray-400 text-xs">{row.sourceType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Biggest Increases & Decreases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Biggest Increases */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Biggest Price Increases</h2>
          {biggestIncreases.length === 0 ? (
            <p className="text-sm text-gray-400">No price increases recorded.</p>
          ) : (
            <ul className="space-y-2">
              {biggestIncreases.map((row) => (
                <li
                  key={row.ingredientId}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <span className="font-medium text-gray-900 text-sm">{row.ingredientName}</span>
                  <span className="text-red-600 font-semibold text-sm">
                    {fmtPct(row.priceDeltaPct)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Biggest Decreases */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Biggest Price Decreases</h2>
          {biggestDecreases.length === 0 ? (
            <p className="text-sm text-gray-400">No price decreases recorded.</p>
          ) : (
            <ul className="space-y-2">
              {biggestDecreases.map((row) => (
                <li
                  key={row.ingredientId}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <span className="font-medium text-gray-900 text-sm">{row.ingredientName}</span>
                  <span className="text-green-600 font-semibold text-sm">
                    {fmtPct(row.priceDeltaPct)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Stale Ingredients */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">
          Stale Ingredients
          <span className="ml-2 text-xs font-normal text-gray-400">
            (no price update in 30+ days)
          </span>
        </h2>
        {staleIngredients.length === 0 ? (
          <p className="text-sm text-green-600 font-medium">All ingredients have recent price data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Ingredient</th>
                  <th className="pb-2 pr-4">Last Updated</th>
                  <th className="pb-2">Days Since Update</th>
                </tr>
              </thead>
              <tbody>
                {staleIngredients.map((row) => (
                  <tr key={row.ingredientId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-900">
                      <Link
                        href={`/ingredients/${row.ingredientId}`}
                        className="hover:text-amber-600"
                      >
                        {row.ingredientName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {row.lastUpdatedAt
                        ? new Date(row.lastUpdatedAt).toLocaleDateString()
                        : <span className="text-amber-600 font-medium">Never</span>}
                    </td>
                    <td className="py-2">
                      {row.daysSinceUpdate !== null ? (
                        <span className="text-amber-600 font-semibold">
                          {row.daysSinceUpdate} days
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold">No data</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
