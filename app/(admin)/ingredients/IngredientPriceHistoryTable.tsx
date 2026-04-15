"use client";

import type { PriceHistoryRowWithDelta } from "@/lib/services/ingredientService";
import { PriceHistorySourceType } from "@/app/generated/prisma/enums";

interface IngredientPriceHistoryTableProps {
  rows: PriceHistoryRowWithDelta[];
}

function DeltaBadge({ delta, pct }: { delta: string | null; pct: string | null }) {
  if (delta === null) return <span className="text-gray-400 text-xs">—</span>;
  const d = parseFloat(delta);
  const isPositive = d > 0;
  const isNeutral = d === 0;
  const color = isNeutral
    ? "text-gray-500"
    : isPositive
    ? "text-red-600"
    : "text-green-600";
  const prefix = isPositive ? "+" : "";
  return (
    <span className={`text-xs font-mono ${color}`}>
      {prefix}${Math.abs(d).toFixed(2)}
      {pct !== null && (
        <span className="ml-1 text-gray-400">
          ({prefix}{parseFloat(pct).toFixed(1)}%)
        </span>
      )}
    </span>
  );
}

function SourceBadge({ source }: { source: PriceHistorySourceType }) {
  const colors: Record<PriceHistorySourceType, string> = {
    [PriceHistorySourceType.MANUAL]: "bg-blue-50 text-blue-700",
    [PriceHistorySourceType.CSV_IMPORT]: "bg-purple-50 text-purple-700",
    [PriceHistorySourceType.SYSTEM]: "bg-gray-100 text-gray-600",
    [PriceHistorySourceType.API_SYNC]: "bg-teal-50 text-teal-700",
    [PriceHistorySourceType.SCRAPER_SYNC]: "bg-orange-50 text-orange-700",
  };
  const labels: Record<PriceHistorySourceType, string> = {
    [PriceHistorySourceType.MANUAL]: "Manual",
    [PriceHistorySourceType.CSV_IMPORT]: "CSV",
    [PriceHistorySourceType.SYSTEM]: "System",
    [PriceHistorySourceType.API_SYNC]: "API Sync",
    [PriceHistorySourceType.SCRAPER_SYNC]: "Scraper",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[source]}`}>
      {labels[source]}
    </span>
  );
}

export default function IngredientPriceHistoryTable({ rows }: IngredientPriceHistoryTableProps) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-400 text-sm">No price history records yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Desktop table */}
      <div className="hidden xl:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Effective From</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Price</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Purchase Unit</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Base Unit</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Tax</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Yield %</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Std Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Price Δ</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Cost Δ%</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Note</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Recorded At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={`hover:bg-gray-50 transition-colors ${i === 0 ? "font-medium" : ""}`}
              >
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {new Date(row.effectiveFrom).toLocaleString("en-NZ")}
                  {i === 0 && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                      Latest
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">
                  ${row.purchasePrice}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {row.purchaseQuantity}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                    {row.purchaseUnit}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                    {row.baseUnit}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-xs">
                  {row.taxIncluded ? (
                    <span className="text-green-600">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  <span className={parseFloat(row.yieldPercent) < 100 ? "text-amber-700 font-medium" : "text-gray-600"}>
                    {row.yieldPercent}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                  {row.standardUnitDisplay ?? <span className="text-gray-400 italic">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeltaBadge delta={row.priceDelta} pct={row.priceDeltaPct} />
                </td>
                <td className="px-4 py-3 text-right">
                  {row.standardCostDeltaPct !== null ? (
                    <span className={`text-xs font-mono ${parseFloat(row.standardCostDeltaPct) > 0 ? "text-red-600" : parseFloat(row.standardCostDeltaPct) < 0 ? "text-green-600" : "text-gray-500"}`}>
                      {parseFloat(row.standardCostDeltaPct) > 0 ? "+" : ""}{row.standardCostDeltaPct}%
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <SourceBadge source={row.sourceType} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                  {row.notes ?? <span className="italic text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(row.createdAt).toLocaleString("en-NZ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/tablet cards */}
      <div className="xl:hidden divide-y divide-gray-100">
        {rows.map((row, i) => (
          <div key={row.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500">
                {new Date(row.effectiveFrom).toLocaleString("en-NZ")}
              </div>
              <div className="flex items-center gap-2">
                {i === 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                    Latest
                  </span>
                )}
                <SourceBadge source={row.sourceType} />
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className="font-mono font-semibold text-gray-900">${row.purchasePrice}</span>
              <span className="text-gray-400">/</span>
              <span className="font-mono text-gray-700">{row.purchaseQuantity}</span>
              <span className="text-xs text-blue-600">{row.purchaseUnit}</span>
              <span className="text-xs text-gray-400">→</span>
              <span className="text-xs text-purple-600">{row.baseUnit}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
              <span>Yield: <span className={parseFloat(row.yieldPercent) < 100 ? "text-amber-700 font-medium" : ""}>{row.yieldPercent}%</span></span>
              <span>Tax: {row.taxIncluded ? <span className="text-green-600">Yes</span> : <span className="text-gray-400">No</span>}</span>
              {row.standardUnitDisplay && (
                <span className="font-mono">{row.standardUnitDisplay}</span>
              )}
            </div>
            {(row.priceDelta !== null || row.standardCostDeltaPct !== null) && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-400">vs prev:</span>
                <DeltaBadge delta={row.priceDelta} pct={row.priceDeltaPct} />
                {row.standardCostDeltaPct !== null && (
                  <span className={`font-mono ${parseFloat(row.standardCostDeltaPct) > 0 ? "text-red-600" : "text-green-600"}`}>
                    cost: {parseFloat(row.standardCostDeltaPct) > 0 ? "+" : ""}{row.standardCostDeltaPct}%
                  </span>
                )}
              </div>
            )}
            {row.notes && (
              <p className="text-xs text-gray-500 italic">{row.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
