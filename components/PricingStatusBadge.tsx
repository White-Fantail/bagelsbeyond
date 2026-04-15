"use client";

import type { PricingStatus } from "@/lib/costing/pricing";

const statusConfig: Record<
  PricingStatus,
  { label: string; className: string }
> = {
  ON_TARGET: { label: "On Target", className: "bg-green-100 text-green-700" },
  ABOVE_TARGET: { label: "Above Target", className: "bg-blue-100 text-blue-700" },
  BELOW_TARGET: { label: "Below Target", className: "bg-red-100 text-red-700" },
  NO_SELLING_PRICE: { label: "No Selling Price", className: "bg-gray-100 text-gray-500" },
  NO_TARGET: { label: "No Target", className: "bg-gray-100 text-gray-500" },
  NO_RECIPE_COST: { label: "No Recipe Cost", className: "bg-amber-100 text-amber-700" },
};

interface PricingStatusBadgeProps {
  status: PricingStatus;
}

export default function PricingStatusBadge({ status }: PricingStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
