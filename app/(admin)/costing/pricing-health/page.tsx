export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getFullPricingHealthSummary, getProductPricingHealth } from "@/lib/services/costingAnalysisService";
import { sortByLargestPriceGap, sortByHighestAdjustedCost } from "@/lib/costing/analysis/pricing-health";
import PricingStatusBadge from "@/components/PricingStatusBadge";
import StatCard from "@/components/StatCard";

function fmt(val: number | null, decimals = 2, prefix = "$"): string {
  if (val === null) return "—";
  return `${prefix}${val.toFixed(decimals)}`;
}

function fmtPct(val: number | null): string {
  if (val === null) return "—";
  return `${val.toFixed(1)}%`;
}

export default async function PricingHealthPage() {
  await requireAdmin();

  const [summary, allRows] = await Promise.all([
    getFullPricingHealthSummary({ isActive: true }),
    getProductPricingHealth({ isActive: true }),
  ]);

  const largestGapRows = sortByLargestPriceGap(allRows).slice(0, 10);
  const highestCostRows = sortByHighestAdjustedCost(allRows).slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/costing/dashboard" className="hover:text-amber-600 transition-colors">Costing Dashboard</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Pricing Health</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Pricing Health</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Product-level pricing health across margin targets, adjusted costs, and recommended prices.
        </p>
      </div>

      {/* Summary Cards */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Total Products" value={summary.totalProducts} color="gray" />
          <StatCard
            title="Below Target"
            value={summary.belowTargetCount}
            color={summary.belowTargetCount > 0 ? "red" : "green"}
            sub="products below margin target"
          />
          <StatCard title="On Target" value={summary.onTargetCount} color="green" />
          <StatCard title="Above Target" value={summary.aboveTargetCount} color="blue" />
          <StatCard
            title="No Selling Price"
            value={summary.noSellingPriceCount}
            color="gray"
          />
          <StatCard
            title="No Recipe Cost"
            value={summary.noRecipeCostCount}
            color="amber"
          />
        </div>
      </section>

      {/* Below Target Products */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          Below Target Products
          <span className="text-sm font-normal text-gray-400">
            ({summary.belowTargetCount})
          </span>
        </h2>

        {summary.belowTargetProducts.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-green-700 text-sm font-medium">
            All products are at or above their pricing target.
          </div>
        ) : (
          <ProductHealthTable rows={summary.belowTargetProducts} fmt={fmt} fmtPct={fmtPct} />
        )}
      </section>

      {/* Largest Price Gap */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">
          Largest Recommended Price Gap
          <span className="ml-2 text-sm font-normal text-gray-400">
            (selling price furthest below recommended)
          </span>
        </h2>
        <ProductHealthTable rows={largestGapRows} fmt={fmt} fmtPct={fmtPct} />
      </section>

      {/* Highest Adjusted Cost */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">
          Highest Adjusted Cost Per Unit
        </h2>
        <ProductHealthTable rows={highestCostRows} fmt={fmt} fmtPct={fmtPct} />
      </section>

      {/* Full list */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">All Active Products</h2>
        <ProductHealthTable rows={allRows} fmt={fmt} fmtPct={fmtPct} />
      </section>
    </div>
  );
}

// ─── Shared table component ───────────────────────────────────────────────────

type Row = Awaited<ReturnType<typeof getProductPricingHealth>>[number];

function ProductHealthTable({
  rows,
  fmt,
  fmtPct,
}: {
  rows: Row[];
  fmt: (v: number | null, d?: number, p?: string) => string;
  fmtPct: (v: number | null) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4">No products to display.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Selling Price</th>
            <th className="px-4 py-3">Adj. Cost/Unit</th>
            <th className="px-4 py-3">Actual Margin</th>
            <th className="px-4 py-3">Actual Cost%</th>
            <th className="px-4 py-3">Target</th>
            <th className="px-4 py-3">Rec. Price</th>
            <th className="px-4 py-3">Price Gap</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.productId} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                <Link
                  href={`/products/${row.productId}/recipe`}
                  className="hover:text-amber-600"
                >
                  {row.productName}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-700">
                {fmt(row.sellingPrice)}
              </td>
              <td className="px-4 py-3 font-mono text-gray-700">
                {fmt(row.adjustedCostPerUnit, 4)}
              </td>
              <td className="px-4 py-3">
                {row.actualMarginPercent !== null ? (
                  <span
                    className={
                      row.pricingStatus === "BELOW_TARGET"
                        ? "text-red-600 font-semibold"
                        : row.pricingStatus === "ABOVE_TARGET"
                        ? "text-blue-600"
                        : "text-green-600"
                    }
                  >
                    {fmtPct(row.actualMarginPercent)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-gray-600">{fmtPct(row.actualCostPercent)}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {row.effectiveTarget ? (
                  <>
                    {row.effectiveTarget.targetType === "MARGIN_PERCENT"
                      ? `${fmtPct(row.effectiveTarget.targetPercent)} margin`
                      : `${fmtPct(row.effectiveTarget.targetPercent)} cost`}
                    {row.effectiveTarget.isOverride && (
                      <span className="ml-1 text-amber-600">(override)</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400">No target</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-700 font-mono">
                {fmt(row.recommendedPrice)}
              </td>
              <td className="px-4 py-3">
                {row.priceGap !== null ? (
                  <span
                    className={
                      row.priceGap < 0
                        ? "text-red-600 font-semibold"
                        : row.priceGap > 0
                        ? "text-blue-600"
                        : "text-gray-500"
                    }
                  >
                    {row.priceGap > 0 ? "+" : ""}
                    {fmt(row.priceGap)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                <PricingStatusBadge status={row.pricingStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
