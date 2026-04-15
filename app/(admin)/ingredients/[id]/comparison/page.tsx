export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { getIngredientById } from "@/lib/services/ingredientService";
import { getIngredientSupplierComparison } from "@/lib/services/costingAnalysisService";
import { buildIngredientHistoryViewModel } from "@/lib/costing/ingredient-price-history";
import type { SupplierComparisonRow } from "@/lib/costing/analysis/ingredient-comparison";

function syncBadge(status: SupplierComparisonRow["syncHealthStatus"]) {
  const map = {
    ok: "bg-green-100 text-green-700",
    stale: "bg-amber-100 text-amber-700",
    unavailable: "bg-red-100 text-red-700",
    manual_only: "bg-gray-100 text-gray-500",
  };
  const labels = {
    ok: "OK",
    stale: "Stale",
    unavailable: "Unavailable",
    manual_only: "Manual",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function comparisonBadge(status: SupplierComparisonRow["comparisonStatus"]) {
  const map = {
    primary: "bg-blue-100 text-blue-700",
    cheaper: "bg-green-100 text-green-700",
    more_expensive: "bg-red-100 text-red-700",
    same: "bg-gray-100 text-gray-600",
    unavailable: "bg-gray-100 text-gray-400",
  };
  const labels = {
    primary: "Primary",
    cheaper: "Cheaper",
    more_expensive: "More Expensive",
    same: "Same",
    unavailable: "N/A",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export default async function IngredientComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [ingredient, comparison, historyViewModel] = await Promise.all([
    getIngredientById(id),
    getIngredientSupplierComparison(id),
    buildIngredientHistoryViewModel(id),
  ]);

  if (!ingredient) notFound();

  return (
    <div className="space-y-8">
      {/* Breadcrumb + Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/ingredients" className="hover:text-amber-600 transition-colors">Ingredients</Link>
          <span>/</span>
          <Link href={`/ingredients/${id}`} className="hover:text-amber-600 transition-colors">
            {ingredient.name}
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Supplier Comparison</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{ingredient.name} — Supplier Comparison</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Compare linked supplier costs using normalized standard unit cost.
        </p>
      </div>

      {/* No supplier links */}
      {!comparison || comparison.links.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
          <p className="text-base">No supplier links found for this ingredient.</p>
          <Link
            href={`/ingredients/${id}/suppliers`}
            className="mt-4 inline-block text-sm text-amber-600 hover:underline"
          >
            Add supplier links →
          </Link>
        </div>
      ) : (
        <>
          {/* Cheapest option banner */}
          {comparison.hasCheaperAlternate && comparison.cheapestLinkId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <span className="text-green-600 text-lg">💡</span>
              <div>
                <p className="text-sm font-medium text-green-800">
                  A cheaper supplier option is available for this ingredient.
                </p>
                {comparison.primaryStandardUnitCost !== null &&
                  comparison.cheapestStandardUnitCost !== null && (
                    <p className="text-xs text-green-600 mt-0.5">
                      Cheapest:{" "}
                      <strong>
                        ${comparison.cheapestStandardUnitCost.toFixed(6)} / unit
                      </strong>{" "}
                      vs. primary:{" "}
                      <strong>
                        ${comparison.primaryStandardUnitCost.toFixed(6)} / unit
                      </strong>
                    </p>
                  )}
              </div>
            </div>
          )}

          {/* Supplier comparison table */}
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-3">Supplier Links</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Effective Price</th>
                    <th className="px-4 py-3">Std Unit Cost</th>
                    <th className="px-4 py-3">vs. Primary</th>
                    <th className="px-4 py-3">vs. Primary %</th>
                    <th className="px-4 py-3">Comparison</th>
                    <th className="px-4 py-3">Sync</th>
                    <th className="px-4 py-3">Last Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.links.map((link) => (
                    <tr key={link.linkId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {link.supplierName}
                        {link.isPrimary && (
                          <span className="ml-1 text-xs text-blue-600 font-normal">(primary)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{link.supplierProductName}</td>
                      <td className="px-4 py-3">
                        {link.isActive ? (
                          <span className="text-green-600 text-xs font-medium">Active</span>
                        ) : (
                          <span className="text-gray-400 text-xs">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        ${link.effectivePurchasePrice.toFixed(2)} /&nbsp;
                        {link.effectivePurchaseQuantity.toFixed(3)}&nbsp;
                        {link.effectivePurchaseUnit}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-800">
                        {link.syncHealthStatus === "unavailable" ? (
                          <span className="text-gray-400 text-xs">Unavailable</span>
                        ) : link.standardUnitCost !== null ? (
                          `$${link.standardUnitCost.toFixed(6)}`
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {link.deltaVsPrimary !== null ? (
                          <span
                            className={
                              link.deltaVsPrimary > 0
                                ? "text-red-600"
                                : link.deltaVsPrimary < 0
                                ? "text-green-600"
                                : "text-gray-500"
                            }
                          >
                            {link.deltaVsPrimary > 0 ? "+" : ""}
                            {link.deltaVsPrimary.toFixed(6)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {link.deltaVsPrimaryPct !== null ? (
                          <span
                            className={
                              link.deltaVsPrimaryPct > 0
                                ? "text-red-600 font-semibold"
                                : link.deltaVsPrimaryPct < 0
                                ? "text-green-600 font-semibold"
                                : "text-gray-500"
                            }
                          >
                            {link.deltaVsPrimaryPct > 0 ? "+" : ""}
                            {link.deltaVsPrimaryPct.toFixed(2)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">{comparisonBadge(link.comparisonStatus)}</td>
                      <td className="px-4 py-3">{syncBadge(link.syncHealthStatus)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {link.lastCheckedAt
                          ? new Date(link.lastCheckedAt).toLocaleDateString()
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Recent price history */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Recent Price History</h2>
        {historyViewModel.rows.length === 0 ? (
          <p className="text-sm text-gray-400">No price history recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Effective From</th>
                  <th className="px-4 py-3">Purchase Price</th>
                  <th className="px-4 py-3">Qty / Unit</th>
                  <th className="px-4 py-3">Std Unit Cost</th>
                  <th className="px-4 py-3">Price Δ</th>
                  <th className="px-4 py-3">Cost Δ%</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {historyViewModel.rows.slice(0, 10).map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(row.effectiveFrom).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900">${row.purchasePrice}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.purchaseQuantity} {row.purchaseUnit}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-800">
                      {row.standardUnitDisplay ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.priceDelta !== null ? (
                        <span
                          className={
                            parseFloat(row.priceDelta) > 0
                              ? "text-red-600"
                              : parseFloat(row.priceDelta) < 0
                              ? "text-green-600"
                              : "text-gray-500"
                          }
                        >
                          {parseFloat(row.priceDelta) > 0 ? "+" : ""}${row.priceDelta}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">First entry</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.standardCostDeltaPct !== null ? (
                        <span
                          className={
                            parseFloat(row.standardCostDeltaPct) > 0
                              ? "text-red-600"
                              : parseFloat(row.standardCostDeltaPct) < 0
                              ? "text-green-600"
                              : "text-gray-500"
                          }
                        >
                          {parseFloat(row.standardCostDeltaPct) > 0 ? "+" : ""}
                          {row.standardCostDeltaPct}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{row.sourceType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/ingredients/${id}/suppliers`}
          className="text-sm text-amber-600 hover:underline"
        >
          Manage Supplier Links →
        </Link>
        <Link
          href={`/ingredients/${id}`}
          className="text-sm text-gray-500 hover:underline"
        >
          Back to Ingredient
        </Link>
      </div>
    </div>
  );
}
