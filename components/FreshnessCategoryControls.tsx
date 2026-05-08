"use client";

import { useTransition } from "react";
import type { ProductCategoryRow } from "@/lib/services/menuProductService";

interface FreshnessCategoryControlsProps {
  categories: ProductCategoryRow[];
  onToggleCategoryManaged: (
    formData: FormData
  ) => Promise<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>;
  onMoveCategory: (
    formData: FormData
  ) => Promise<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>;
}

function CategoryRow({
  category,
  canMoveUp,
  canMoveDown,
  onToggleCategoryManaged,
  onMoveCategory,
}: {
  category: ProductCategoryRow;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleCategoryManaged: FreshnessCategoryControlsProps["onToggleCategoryManaged"];
  onMoveCategory: FreshnessCategoryControlsProps["onMoveCategory"];
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
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{category.name}</p>
        <p className="text-xs text-gray-500">
          Order: {category.freshnessSortOrder} ·{" "}
          <span
            className={
              category.isFreshnessManaged ? "text-green-600 font-medium" : "text-gray-400"
            }
          >
            {category.isFreshnessManaged ? "Freshness Managed" : "Hidden"}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          aria-label="Move category up"
          disabled={isPending || !canMoveUp}
          onClick={() => handleMove("up")}
          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="Move category down"
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
    </div>
  );
}

export default function FreshnessCategoryControls({
  categories,
  onToggleCategoryManaged,
  onMoveCategory,
}: FreshnessCategoryControlsProps) {
  const orderedCategories = [...categories].sort(
    (a, b) => a.freshnessSortOrder - b.freshnessSortOrder || a.name.localeCompare(b.name)
  );

  if (orderedCategories.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-gray-400">No categories found.</div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {orderedCategories.map((category, index) => (
        <CategoryRow
          key={category.id}
          category={category}
          canMoveUp={index > 0}
          canMoveDown={index < orderedCategories.length - 1}
          onToggleCategoryManaged={onToggleCategoryManaged}
          onMoveCategory={onMoveCategory}
        />
      ))}
    </div>
  );
}
