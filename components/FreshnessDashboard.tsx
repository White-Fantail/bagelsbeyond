"use client";

import Link from "next/link";
import { useTransition } from "react";
import type {
  FreshnessDashboardCategoryGroup,
  FreshnessDashboardItem,
} from "@/lib/services/freshnessService";
import type {
  MenuProductRow,
  ProductCategoryRow,
} from "@/lib/services/menuProductService";
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
  groups: FreshnessDashboardCategoryGroup[];
  categories: ProductCategoryRow[];
  products: MenuProductRow[];
  onAddLog: (
    formData: FormData
  ) => Promise<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>;
}

function ProductRow({
  item,
  products,
  onAddLog,
}: {
  item: FreshnessDashboardItem;
  products: MenuProductRow[];
  onAddLog: FreshnessDashboardProps["onAddLog"];
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mt-0.5">
          {item.storageType && (
            <span>{STORAGE_TYPE_LABELS[item.storageType] ?? item.storageType}</span>
          )}
          {item.shelfLifeDays != null && <span>{item.shelfLifeDays} days</span>}
          {item.latestLog && (
            <span className="text-gray-400">
              {item.latestLog.logType === "DISPLAYED" ? "Displayed" : "Made"}{" "}
              {formatDate(item.latestLog.loggedAt)}
            </span>
          )}
        </div>
      </div>
      <FreshnessStatusBadge
        status={item.status}
        daysElapsed={item.daysElapsed}
        daysRemaining={item.daysRemaining}
        shelfLifeDays={item.shelfLifeDays}
      />
      <AddFreshnessLogDialog
        products={products}
        initialProductId={item.productId}
        onSubmit={onAddLog}
        triggerLabel="+"
      />
    </div>
  );
}

export default function FreshnessDashboard({
  groups,
  categories,
  products,
  onAddLog,
}: FreshnessDashboardProps) {
  const orderedCategories = [...categories].sort(
    (a, b) => a.freshnessSortOrder - b.freshnessSortOrder || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6">
      {/* Shortcut to category settings */}
      <div className="flex justify-end">
        <Link
          href="/freshness/categories"
          className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          ⚙️ Category Settings
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-sm">No freshness-managed categories or active products.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group) => {
            const categoryIndex = orderedCategories.findIndex((c) => c.id === group.categoryId);
            return (
              <section key={group.categoryId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">{group.categoryName}</h3>
                  <ul className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500" aria-label={`${group.categoryName} status summary`}>
                    <li>Expired: {group.summary.expiredCount}</li>
                    <li>Warning: {group.summary.warningCount}</li>
                    <li>Fresh: {group.summary.okCount}</li>
                    <li>No Logs: {group.summary.noLogCount}</li>
                  </ul>
                </div>
                {group.items.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-400">No active products.</div>
                ) : (
                  <div>
                    {group.items.map((item) => (
                      <ProductRow key={item.productId} item={item} products={products} onAddLog={onAddLog} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
