export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import Link from "next/link";
import CatalogSyncButton from "./CatalogSyncButton";
import CategoryManagerClient, { type CategoryRow } from "./CategoryManagerClient";

export default async function AdminCategoriesPage() {
  await requireAdmin();

  const [categories, lastSyncEntry] = await Promise.all([
    prisma.loyverseCategory.findMany({
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
    }),
    prisma.externalProductMap.findFirst({
      where: { source: IntegrationSource.LOYVERSE },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
  ]);

  const rows: CategoryRow[] = categories.map((c) => ({
    ...c,
    updatedAt: c.updatedAt.toISOString(),
  }));

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
            {lastSyncEntry?.lastSyncedAt
              ? lastSyncEntry.lastSyncedAt.toLocaleString("en-NZ")
              : "None"}
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

