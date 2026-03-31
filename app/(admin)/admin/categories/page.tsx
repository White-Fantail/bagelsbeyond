export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listCategories } from "@/lib/catalog/queries/categories";
import { Suspense } from "react";
import Link from "next/link";
import CategoriesTable from "@/components/admin/catalog/CategoriesTable";
import CatalogSearchFilter from "@/components/admin/catalog/CatalogSearchFilter";

type SearchParams = { search?: string };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";

  const categories = await listCategories(search || undefined);

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
            <span className="text-gray-700 font-medium">Categories</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Manage display order and visibility of synced catalog categories.
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
            href="/admin/categories"
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            ↺ Refresh
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Categories</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{categories.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-500">Visible</p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            {categories.filter((c) => c.isVisible).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-500">Synced (Loyverse)</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {categories.filter((c) => c.sourceChannel === "LOYVERSE").length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-yellow-100 p-4">
          <p className="text-xs text-yellow-600">Unmapped</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">
            {categories.filter((c) => !c.sourceChannel).length}
          </p>
        </div>
      </div>

      {/* Search filter */}
      <Suspense fallback={null}>
        <CatalogSearchFilter basePath="/admin/categories" placeholder="Search categories…" />
      </Suspense>

      {/* Results info */}
      <div className="text-sm text-gray-500">
        {search ? (
          <>
            Results for &ldquo;<strong className="text-gray-700">{search}</strong>&rdquo; —{" "}
            <strong className="text-gray-700">{categories.length}</strong> found
          </>
        ) : (
          <>
            All <strong className="text-gray-700">{categories.length}</strong> categories
          </>
        )}
      </div>

      {/* Table */}
      <CategoriesTable categories={categories} />
    </div>
  );
}
