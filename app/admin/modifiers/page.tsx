export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { listModifierGroups } from "@/lib/catalog/queries/modifiers";
import { Suspense } from "react";
import Link from "next/link";
import ModifiersTable from "@/components/admin/catalog/ModifiersTable";
import CatalogSearchFilter from "@/components/admin/catalog/CatalogSearchFilter";

type SearchParams = { search?: string };

export default async function ModifiersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";

  const groups = await listModifierGroups(search || undefined);

  const totalOptions = groups.reduce((sum, g) => sum + g.optionCount, 0);
  const syncedCount = groups.filter((g) => g.sourceChannel === "LOYVERSE").length;
  const linkedCount = groups.filter((g) => g.linkedItemCount > 0).length;

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
            <span className="text-gray-700 font-medium">Modifiers</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Modifiers</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            View synced modifier groups and their options from the connected POS system.
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
            href="/admin/modifiers"
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            ↺ Refresh
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Modifier Groups</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{groups.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-100 p-4">
          <p className="text-xs text-purple-500">Total Options</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{totalOptions}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-500">Synced (Loyverse)</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{syncedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-4">
          <p className="text-xs text-amber-600">Linked to Items</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{linkedCount}</p>
        </div>
      </div>

      {/* Search filter */}
      <Suspense fallback={null}>
        <CatalogSearchFilter basePath="/admin/modifiers" placeholder="Search modifier groups…" />
      </Suspense>

      {/* Results info */}
      <div className="text-sm text-gray-500">
        {search ? (
          <>
            Results for &ldquo;<strong className="text-gray-700">{search}</strong>&rdquo; —{" "}
            <strong className="text-gray-700">{groups.length}</strong> found
          </>
        ) : (
          <>
            All <strong className="text-gray-700">{groups.length}</strong> modifier groups
          </>
        )}
      </div>

      {/* Table */}
      <ModifiersTable groups={groups} />
    </div>
  );
}
