export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { buildProductionPlan } from "@/lib/planning/ingredient-needs";

function fmtMoney(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `$${Math.abs(n).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}%`;
}

function marginColor(margin: number | null): string {
  if (margin === null) return "text-gray-400";
  if (margin >= 60) return "text-green-700";
  if (margin >= 40) return "text-amber-600";
  return "text-red-600";
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProfitabilityPage({
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

  const products = plan?.profitForecast.products ?? [];
  const totals = plan?.profitForecast.totals;

  const topProfit = [...products]
    .filter((p) => p.expectedGrossProfit !== null)
    .sort((a, b) => (b.expectedGrossProfit ?? 0) - (a.expectedGrossProfit ?? 0))
    .slice(0, 5);

  const topCost = [...products]
    .filter((p) => p.expectedCost !== null)
    .sort((a, b) => (b.expectedCost ?? 0) - (a.expectedCost ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href={`/forecast/production-plan?date=${targetDate}`} className="hover:text-amber-600 transition-colors">
            Production Plan
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Profitability</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Forecast Profitability</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Predicted revenue, cost, and gross profit for the production plan on {targetDate}.
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
          Load
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {plan && (
        <>
          {/* Totals */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Predicted Revenue", value: fmtMoney(totals?.totalPredictedRevenue ?? null), color: "text-blue-700" },
              { label: "Expected Cost", value: fmtMoney(totals?.totalExpectedCost ?? null), color: "text-orange-600" },
              {
                label: "Gross Profit",
                value: fmtMoney(totals?.totalExpectedGrossProfit ?? null),
                color: (totals?.totalExpectedGrossProfit ?? 0) >= 0 ? "text-green-700" : "text-red-700",
              },
              { label: "Overall Margin", value: fmtPct(totals?.overallGrossMarginPercent ?? null), color: marginColor(totals?.overallGrossMarginPercent ?? null) },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </section>

          {/* Top contributors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top profit contributors */}
            <section>
              <h2 className="text-base font-semibold text-gray-700 mb-3">Top Profit Contributors</h2>
              {topProfit.length === 0 ? (
                <p className="text-sm text-gray-400">No profit data available.</p>
              ) : (
                <ul className="space-y-2">
                  {topProfit.map((p) => (
                    <li key={p.productId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900 text-sm">{p.productName}</span>
                        <span className="ml-2 text-xs text-gray-400">({p.predictedSalesQty} units)</span>
                      </div>
                      <div className="text-right">
                        <span className="text-green-700 font-semibold text-sm block">{fmtMoney(p.expectedGrossProfit)}</span>
                        <span className={`text-xs ${marginColor(p.grossMarginPercent)}`}>{fmtPct(p.grossMarginPercent)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Top cost contributors */}
            <section>
              <h2 className="text-base font-semibold text-gray-700 mb-3">Top Cost Contributors</h2>
              {topCost.length === 0 ? (
                <p className="text-sm text-gray-400">No cost data available.</p>
              ) : (
                <ul className="space-y-2">
                  {topCost.map((p) => (
                    <li key={p.productId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900 text-sm">{p.productName}</span>
                        <span className="ml-2 text-xs text-gray-400">({p.predictedSalesQty} units)</span>
                      </div>
                      <div className="text-right">
                        <span className="text-orange-600 font-semibold text-sm block">{fmtMoney(p.expectedCost)}</span>
                        <span className="text-xs text-gray-400">{fmtMoney(p.sellingPrice)} / unit</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Per-product breakdown */}
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-3">Per-Product Breakdown</h2>
            {products.length === 0 ? (
              <p className="text-sm text-gray-400">No plannable products with forecast data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Forecast Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase">Revenue</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-orange-600 uppercase">Cost</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-green-600 uppercase">Gross Profit</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-purple-600 uppercase">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((p) => (
                      <tr key={p.productId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.productName}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{p.predictedSalesQty}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmtMoney(p.sellingPrice)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {p.adjustedUnitCost !== null ? `$${p.adjustedUnitCost.toFixed(4)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-700 font-medium">{fmtMoney(p.predictedRevenue)}</td>
                        <td className="px-4 py-3 text-right text-orange-600">{fmtMoney(p.expectedCost)}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span className={p.expectedGrossProfit !== null && p.expectedGrossProfit >= 0 ? "text-green-700" : "text-red-600"}>
                            {fmtMoney(p.expectedGrossProfit)}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${marginColor(p.grossMarginPercent)}`}>
                          {fmtPct(p.grossMarginPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="px-4 py-3 font-bold text-gray-900" colSpan={4}>Total</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{fmtMoney(totals?.totalPredictedRevenue ?? null)}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">{fmtMoney(totals?.totalExpectedCost ?? null)}</td>
                      <td className="px-4 py-3 text-right font-bold">
                        <span className={totals && totals.totalExpectedGrossProfit >= 0 ? "text-green-700" : "text-red-600"}>
                          {fmtMoney(totals?.totalExpectedGrossProfit ?? null)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${marginColor(totals?.overallGrossMarginPercent ?? null)}`}>
                        {fmtPct(totals?.overallGrossMarginPercent ?? null)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
