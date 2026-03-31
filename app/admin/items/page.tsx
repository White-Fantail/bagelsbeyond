export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listItems } from "@/lib/catalog/queries/items";
import { listCategories } from "@/lib/catalog/queries/categories";
import { Suspense } from "react";
import Link from "next/link";
import ItemsTable from "@/components/admin/catalog/ItemsTable";
import ItemsFilter from "@/components/admin/catalog/ItemsFilter";

type SearchParams = { search?: string; categoryId?: string };

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const categoryId = sp.categoryId?.trim() ?? "";

  const [items, categories] = await Promise.all([
    listItems({
      search: search || undefined,
      categoryId: categoryId || undefined,
    }),
    listCategories(),
  ]);

  const visibleCount = items.filter((i) => i.isVisible).length;
  const syncedCount = items.filter((i) => i.sourceChannel === "LOYVERSE").length;
  const withModifiers = items.filter((i) => i.modifierGroupCount > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600 transition-colors">
              Admin Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Items</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Items</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            View and manage synced catalog items. Core fields are read-only (source-of-truth).
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href="/admin/integrations/loyverse"
            className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            🔄 Sync from Loyverse
          </Link>
          <Link
            href="/admin/items"
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            ↺ Refresh
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-500">Visible</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{visibleCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-500">Synced (Loyverse)</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{syncedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-100 p-4">
          <p className="text-xs text-purple-500">With Modifiers</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{withModifiers}</p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <ItemsFilter
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          currentCategoryId={categoryId}
        />
      </Suspense>

      {/* Results info */}
      <div className="text-sm text-gray-500">
        {search || categoryId ? (
          <>
            Filtered results —{" "}
            <strong className="text-gray-700">{items.length}</strong> found
          </>
        ) : (
          <>
            All <strong className="text-gray-700">{items.length}</strong> items
          </>
        )}
      </div>

      {/* Table */}
      <ItemsTable items={items} />
    </div>
  );
}
