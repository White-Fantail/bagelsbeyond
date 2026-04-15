"use client";

import type { ProductPricingSummary } from "@/lib/costing/pricing";
import PricingStatusBadge from "@/components/PricingStatusBadge";

interface RecipePricingSummaryProps {
  pricing: ProductPricingSummary;
  targetLabel: string;
}

export default function RecipePricingSummary({ pricing, targetLabel }: RecipePricingSummaryProps) {
  const { sellingPrice, adjustedCost, actualCostPercent, actualMarginPercent, recommendedPrice, priceGap, pricingStatus } = pricing;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        Pricing Summary
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Selling Price */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Selling Price</p>
          {sellingPrice != null ? (
            <p className="text-lg font-semibold text-gray-900">${sellingPrice.toFixed(2)}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No selling price</p>
          )}
        </div>

        {/* Adjusted Cost */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Adjusted Cost</p>
          {adjustedCost != null ? (
            <p className="text-lg font-semibold text-gray-900">${adjustedCost.toFixed(4)}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No recipe cost</p>
          )}
        </div>

        {/* Actual Cost % */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Actual Cost %</p>
          {actualCostPercent != null ? (
            <p className="text-lg font-semibold text-gray-700">{actualCostPercent.toFixed(1)}%</p>
          ) : (
            <p className="text-sm text-gray-400 italic">—</p>
          )}
        </div>

        {/* Actual Margin % */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Actual Margin %</p>
          {actualMarginPercent != null ? (
            <p className="text-lg font-semibold text-gray-700">{actualMarginPercent.toFixed(1)}%</p>
          ) : (
            <p className="text-sm text-gray-400 italic">—</p>
          )}
        </div>

        {/* Target */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Target</p>
          <p className="text-sm font-medium text-gray-700">{targetLabel}</p>
        </div>

        {/* Recommended Price */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Recommended Price</p>
          {recommendedPrice != null ? (
            <p className="text-lg font-semibold text-amber-700">${recommendedPrice.toFixed(2)}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">—</p>
          )}
        </div>

        {/* Price Gap */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Price Gap</p>
          {priceGap != null ? (
            <p
              className={`text-lg font-semibold ${
                Math.abs(priceGap) < 0.01
                  ? "text-green-700"
                  : priceGap > 0
                  ? "text-blue-700"
                  : "text-red-700"
              }`}
            >
              {priceGap >= 0 ? "+" : ""}${priceGap.toFixed(2)}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">—</p>
          )}
        </div>

        {/* Status */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Status</p>
          <PricingStatusBadge status={pricingStatus} />
        </div>
      </div>

      {pricingStatus === "ABOVE_TARGET" && priceGap != null && (
        <p className="mt-3 text-xs text-blue-600">
          ✓ Selling price is ${Math.abs(priceGap).toFixed(2)} above the recommended price — above target.
        </p>
      )}
      {pricingStatus === "BELOW_TARGET" && priceGap != null && (
        <p className="mt-3 text-xs text-red-600">
          ⚠ Selling price is ${Math.abs(priceGap).toFixed(2)} below the recommended price — consider a price increase.
        </p>
      )}
    </div>
  );
}
