"use client";

import type { FreshnessDashboardItem } from "@/lib/services/freshnessService";
import type { MenuProductRow } from "@/lib/services/menuProductService";
import FreshnessStatusBadge from "./FreshnessStatusBadge";
import AddFreshnessLogDialog from "./AddFreshnessLogDialog";

const STORAGE_TYPE_LABELS: Record<string, string> = {
  FROZEN: "❄️ Frozen",
  REFRIGERATED: "🧊 Refrigerated",
  AMBIENT: "🌡️ Ambient",
};

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FreshnessDashboardProps {
  items: FreshnessDashboardItem[];
  products: MenuProductRow[];
  onAddLog: (formData: FormData) => Promise<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>;
}

export default function FreshnessDashboard({
  items,
  products,
  onAddLog,
}: FreshnessDashboardProps) {
  const expiredCount = items.filter((i) => i.status === "expired").length;
  const warningCount = items.filter((i) => i.status === "warning").length;
  const okCount = items.filter((i) => i.status === "ok" && i.latestLog).length;
  const noLogCount = items.filter((i) => !i.latestLog).length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-xs text-red-600 font-medium">Expired</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{expiredCount}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <p className="text-xs text-yellow-600 font-medium">Warning</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{warningCount}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-xs text-green-600 font-medium">Fresh</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{okCount}</p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">No Logs</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{noLogCount}</p>
        </div>
      </div>

      {/* Product cards */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-sm">No active products.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <FreshnessDashboardCard
              key={item.productId}
              item={item}
              products={products}
              onAddLog={onAddLog}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FreshnessDashboardCard({
  item,
  products,
  onAddLog,
}: {
  item: FreshnessDashboardItem;
  products: MenuProductRow[];
  onAddLog: FreshnessDashboardProps["onAddLog"];
}) {
  const cardBorderClass =
    item.latestLog
      ? item.status === "expired"
        ? "border-red-300 bg-red-50"
        : item.status === "warning"
        ? "border-yellow-300 bg-yellow-50"
        : "border-green-200 bg-white"
      : "border-gray-200 bg-white";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${cardBorderClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {item.categoryName && (
              <span className="text-xs text-gray-500">{item.categoryName}</span>
            )}
            {item.storageType && (
              <span className="text-xs text-gray-500">
                {STORAGE_TYPE_LABELS[item.storageType] ?? item.storageType}
              </span>
            )}
            {item.shelfLifeDays != null && (
              <span className="text-xs text-gray-400">Shelf life: {item.shelfLifeDays} days</span>
            )}
          </div>
        </div>
        <AddFreshnessLogDialog
          products={products}
          initialProductId={item.productId}
          onSubmit={onAddLog}
          triggerLabel="+"
        />
      </div>

      {/* Status */}
      {item.latestLog ? (
        <>
          <FreshnessStatusBadge
            status={item.status}
            daysElapsed={item.daysElapsed}
            daysRemaining={item.daysRemaining}
            shelfLifeDays={item.shelfLifeDays}
          />
          <div className="text-xs text-gray-500 space-y-0.5">
            <p>
              <span className="font-medium">
                {item.latestLog.logType === "DISPLAYED" ? "Displayed" : "Made"}:
              </span>{" "}
              {formatDate(item.latestLog.loggedAt)}
            </p>
            {item.latestLog.notes && (
              <p className="text-gray-400 truncate">{item.latestLog.notes}</p>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400 italic">No logs yet.</p>
      )}
    </div>
  );
}
