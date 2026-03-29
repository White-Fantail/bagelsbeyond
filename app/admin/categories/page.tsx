export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";
import CatalogSyncButton from "./CatalogSyncButton";
import CategoryManagerClient, { type CategoryRow } from "./CategoryManagerClient";

export default async function AdminCategoriesPage() {
  await requireAdmin();

  // Prefer canonical Category table (new architecture)
  const canonicalCount = await prisma.category.count();

  let rows: CategoryRow[];
  let isCanonical = false;

  if (canonicalCount > 0) {
    // New architecture: use canonical categories
    isCanonical = true;
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isVisible: true,
        displayOrder: true,
        updatedAt: true,
      },
    });
    rows = categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: null,
      isVisible: c.isVisible,
      displayOrder: c.displayOrder,
      source: "canonical",
      updatedAt: c.updatedAt.toISOString(),
    }));
  } else {
    // Fallback: legacy LoyverseCategory (before backfill is run)
    const categories = await prisma.loyverseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        isVisible: true,
        displayOrder: true,
        source: true,
        updatedAt: true,
      },
    });
    rows = categories.map((c) => ({
      ...c,
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  // Last sync time from new SyncJob table or legacy full sync log
  const lastSyncAt = await prisma.syncJob
    .findFirst({
      where: { channel: "LOYVERSE", status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    })
    .then((j) => j?.startedAt ?? null)
    .catch(() => null) ??
    await prisma.loyverseFullSyncLog
      .findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } })
      .then((j) => j?.syncedAt ?? null)
      .catch(() => null);

  const visibleCount = rows.filter((c) => c.isVisible).length;
  const hiddenCount = rows.length - visibleCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600 transition-colors">
              Admin Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Category Management</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Category Management</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Manage display order and visibility of categories
            {isCanonical && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                ✓ New Architecture
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Categories</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{rows.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">Visible</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{visibleCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400">Hidden</p>
          <p className="text-2xl font-bold text-gray-500 mt-1">{hiddenCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Last Catalog Sync</p>
          <p className="text-sm font-medium text-gray-700 mt-1">
            {lastSyncAt ? lastSyncAt.toLocaleString("en-NZ") : "None"}
          </p>
        </div>
      </div>

      {/* Loyverse sync control */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">Loyverse Catalog Sync</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Fetches products, categories, and modifiers from Loyverse.{" "}
            <strong>Display order and visibility are preserved on re-sync.</strong>
          </p>
        </div>
        <CatalogSyncButton />
      </div>

      {/* Category list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-base">Category List</h2>
          <p className="text-xs text-gray-400">
            Use ▲ / ▼ to reorder · Toggle switch to show/hide on customer menu
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            <p>No synced categories yet. Run Loyverse Sync to get started.</p>
          </div>
        ) : (
          <CategoryManagerClient initialCategories={rows} />
        )}
      </div>
    </div>
  );
}


