"use client";

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
  onToggleCategoryManaged: (
    formData: FormData
  ) => Promise<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>;
  onMoveCategory: (
    formData: FormData
  ) => Promise<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>;
}

function CategoryActionButtons({
  category,
  canMoveUp,
  canMoveDown,
  onToggleCategoryManaged,
  onMoveCategory,
}: {
  category: Pick<ProductCategoryRow, "id" | "isFreshnessManaged">;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleCategoryManaged: FreshnessDashboardProps["onToggleCategoryManaged"];
  onMoveCategory: FreshnessDashboardProps["onMoveCategory"];
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const formData = new FormData();
    formData.set("categoryId", category.id);
    formData.set("isFreshnessManaged", String(!category.isFreshnessManaged));
    startTransition(async () => {
      await onToggleCategoryManaged(formData);
    });
  }

  function handleMove(direction: "up" | "down") {
    const formData = new FormData();
    formData.set("categoryId", category.id);
    formData.set("direction", direction);
    startTransition(async () => {
      await onMoveCategory(formData);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={isPending || !canMoveUp}
        onClick={() => handleMove("up")}
        className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={isPending || !canMoveDown}
        onClick={() => handleMove("down")}
        className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        ↓
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={handleToggle}
        className={`px-2.5 py-1 text-xs rounded border font-medium disabled:opacity-50 ${
          category.isFreshnessManaged
            ? "border-green-300 text-green-700 hover:bg-green-50"
            : "border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
      >
        {category.isFreshnessManaged ? "Managed" : "Hidden"}
      </button>
    </div>
  );
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
  onToggleCategoryManaged,
  onMoveCategory,
}: FreshnessDashboardProps) {
  const orderedCategories = [...categories].sort(
    (a, b) => a.freshnessSortOrder - b.freshnessSortOrder || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Freshness Category Controls</h2>
        </div>
        {orderedCategories.length === 0 ? (
          <div className="px-4 py-8 text-sm text-gray-400">No categories found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orderedCategories.map((category, index) => (
              <div key={category.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{category.name}</p>
                  <p className="text-xs text-gray-500">Order: {category.freshnessSortOrder}</p>
                </div>
                <CategoryActionButtons
                  category={category}
                  canMoveUp={index > 0}
                  canMoveDown={index < orderedCategories.length - 1}
                  onToggleCategoryManaged={onToggleCategoryManaged}
                  onMoveCategory={onMoveCategory}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-sm">No freshness-managed categories or active products.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const category = orderedCategories.find((c) => c.id === group.categoryId);
            const categoryIndex = orderedCategories.findIndex((c) => c.id === group.categoryId);
            return (
              <section key={group.categoryId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{group.categoryName}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Expired {group.summary.expiredCount} · Warning {group.summary.warningCount} · Fresh {group.summary.okCount} · No Logs {group.summary.noLogCount}
                    </p>
                  </div>
                  {category && (
                    <CategoryActionButtons
                      category={category}
                      canMoveUp={categoryIndex > 0}
                      canMoveDown={categoryIndex > -1 && categoryIndex < orderedCategories.length - 1}
                      onToggleCategoryManaged={onToggleCategoryManaged}
                      onMoveCategory={onMoveCategory}
                    />
                  )}
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
