export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import Link from "next/link";
import CatalogSyncButton from "./CatalogSyncButton";

export default async function AdminCategoriesPage() {
  await requireAdmin();

  const [loyverseCategories, lastSyncEntry, totalMapped] = await Promise.all([
    prisma.loyverseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        products: {
          select: {
            id: true,
            name: true,
            isActive: true,
            externalMappings: {
              where: { source: IntegrationSource.LOYVERSE },
              select: { id: true, lastSyncedAt: true },
            },
          },
        },
      },
    }),
    prisma.externalProductMap.findFirst({
      where: { source: IntegrationSource.LOYVERSE },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
    prisma.externalProductMap.count({
      where: { source: IntegrationSource.LOYVERSE },
    }),
  ]);

  // Also count products with no category
  const uncategorisedCount = await prisma.product.count({
    where: { loyverseCategoryId: null },
  });

  const totalProducts = loyverseCategories.reduce(
    (sum, cat) => sum + cat.products.length,
    0
  ) + uncategorisedCount;
  const activeProducts = await prisma.product.count({ where: { isActive: true } });

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
            Manage products by category based on Loyverse catalog sync
          </p>
        </div>
      </div>

      {/* Sync policy notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">🔗 Category Management based on Loyverse Sync</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 text-xs">
          <li>Categories are fetched as-is from Loyverse — do not define categories locally</li>
          <li>Do not manually create or manage categories — use Loyverse Sync as the default</li>
          <li>Products are linked based on Loyverse category ID</li>
        </ul>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">All Products</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">Active Products</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeProducts}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-600">Loyverse Integration</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{totalMapped}</p>
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
          <h2 className="font-semibold text-gray-900">Loyverse catalog Sync</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Fetches Products, Categories, and Modifiers from Loyverse. Categories are automatically updated on Sync.
          </p>
        </div>
        <CatalogSyncButton />
      </div>

      {/* Category breakdown */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900 text-base">Product Status by Category</h2>
        {loyverseCategories.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            <p>No synced categories yet. Run Loyverse Sync.</p>
          </div>
        ) : (
          loyverseCategories.map((cat) => {
            const loyverseCount = cat.products.filter((p) => p.externalMappings.length > 0).length;
            const activeCount = cat.products.filter((p) => p.isActive).length;
            return (
              <div key={cat.id} className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-blue-800">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-blue-700">
                    <span>{cat.products.length} Products</span>
                    <span>{activeCount} Active</span>
                    {loyverseCount > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white bg-opacity-60 font-medium">
                        🔗 Loyverse {loyverseCount}
                      </span>
                    )}
                  </div>
                </div>
                {cat.products.length === 0 ? (
                  <p className="text-xs text-blue-400">No products in this category</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cat.products.map((p) => (
                      <Link
                        key={p.id}
                        href={`/admin/products/${p.id}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white bg-opacity-70 hover:bg-opacity-100 transition-all border border-blue-200 text-blue-800 ${
                          p.isActive ? "opacity-100" : "opacity-40"
                        }`}
                      >
                        {p.externalMappings.length > 0 && <span>🔗</span>}
                        {p.name}
                        {!p.isActive && <span className="text-xs opacity-60">(Inactive)</span>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Uncategorised products */}
        {uncategorisedCount > 0 && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-semibold text-gray-700">Categories None</span>
              <span className="text-xs text-gray-500">{uncategorisedCount} Products</span>
            </div>
            <p className="text-xs text-gray-400">
              Loyverse Products not linked to Categories. They will be linked automatically after Sync.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
