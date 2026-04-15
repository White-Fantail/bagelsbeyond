export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { buildProductionPlan } from "@/lib/planning/ingredient-needs";

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtMoney(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `$${fmtNum(n)}`;
}

function fmtPct(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}%`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProductionPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const targetDate = params.date ?? todayStr();

  let plan: Awaited<ReturnType<typeof buildProductionPlan>> | null = null;
  let error: string | null = null;

  try {
    plan = await buildProductionPlan(targetDate);
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Failed to load plan";
  }

  const hasProducts = plan && plan.products.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Production Plan</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Production Plan</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Forecast-driven production recommendations, ingredient needs, and profitability for a target date.
        </p>
      </div>

      {/* Date selector */}
      <form method="GET" className="flex items-center gap-3">
        <label htmlFor="date" className="text-sm font-medium text-gray-700">Target Date</label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={targetDate}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          className="px-4 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium transition-colors"
        >
          Load Plan
        </button>
        <Link
          href={`/forecast/ingredient-needs?date=${targetDate}`}
          className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm transition-colors"
        >
          🧾 Ingredient Needs
        </Link>
        <Link
          href={`/forecast/profitability?date=${targetDate}`}
          className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm transition-colors"
        >
          📈 Profitability
        </Link>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {plan && (
        <>
          {/* Settings */}
          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Planning Settings</h2>
            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
              <span>Buffer: <strong>{plan.settings.bufferPercent}%</strong></span>
              <span>Rounding: <strong>{plan.settings.roundingMode}</strong></span>
              <span>Batch handling: <strong>{plan.settings.batchHandlingMode}</strong></span>
            </div>
          </section>

          {!hasProducts ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-700 font-medium mb-1">No plannable products found.</p>
              <p className="text-sm text-gray-500">
                Mark products as{" "}
                <strong>Production Plannable</strong>{" "}
                and set forecast quantities to see a plan here.
              </p>
              <Link
                href="/products"
                className="mt-4 inline-block px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm transition-colors"
              >
                Go to Products
              </Link>
            </div>
          ) : (
            <>
              {/* Profitability summary bar */}
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Predicted Revenue",
                    value: fmtMoney(plan.profitForecast.totals.totalPredictedRevenue),
                    color: "text-blue-700",
                  },
                  {
                    label: "Expected Cost",
                    value: fmtMoney(plan.profitForecast.totals.totalExpectedCost),
                    color: "text-orange-600",
                  },
                  {
                    label: "Gross Profit",
                    value: fmtMoney(plan.profitForecast.totals.totalExpectedGrossProfit),
                    color: plan.profitForecast.totals.totalExpectedGrossProfit >= 0 ? "text-green-700" : "text-red-700",
                  },
                  {
                    label: "Margin",
                    value: fmtPct(plan.profitForecast.totals.overallGrossMarginPercent),
                    color: "text-purple-700",
                  },
                ].map((card) => (
                  <div key={card.label} className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                    <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                  </div>
                ))}
              </section>

              {/* Production plan table */}
              <section>
                <h2 className="text-base font-semibold text-gray-700 mb-3">Product Production Plan</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Forecast Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Buffered Target</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-amber-600 uppercase">Rec. Production</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Batch Size</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Batches</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {plan.products.map((row) => (
                        <tr key={row.productId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.productName}</td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {fmtNum(row.predictedSalesQty, 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {fmtNum(row.recommendation.bufferedTargetQty, 1)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-700">
                            {fmtNum(row.recommendation.recommendedProductionQty, 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {row.recommendation.batchSize ? fmtNum(row.recommendation.batchSize, 0) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {row.recommendation.recommendedBatchCount !== null
                              ? row.recommendation.recommendedBatchCount
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {row.adjustedUnitCost !== null ? `$${row.adjustedUnitCost.toFixed(4)}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {row.sellingPrice !== null ? `$${row.sellingPrice.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {row.hasOverride ? (
                              <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 font-medium">Manual</span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">System</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Forecast override guidance */}
              <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800 mb-1">Set Forecast Quantities</p>
                <p className="text-sm text-amber-700">
                  Use the{" "}
                  <strong>Forecast Overrides API</strong>{" "}
                  (<code className="bg-amber-100 px-1 rounded">POST /api/admin/planning/forecast-overrides</code>)
                  or the product settings page to set per-product forecast quantities for this date.
                  Products without an override show a forecast of 0.
                </p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
