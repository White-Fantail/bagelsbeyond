export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Suspense } from "react";
import ProductFilters from "./ProductFilters";

type SearchParams = {
  search?: string;
  category?: string;
  source?: string;
  isActive?: string;
  subscription?: string;
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const categoryFilter = sp.category ?? "ALL";
  const activeFilter = sp.isActive ?? "ALL";
  const subscriptionFilter = sp.subscription ?? "ALL";

  const hasFilters = !!(sp.search || sp.category || sp.isActive || sp.subscription);

  // Build where clause
  const where: Record<string, unknown> = {};

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  // Filter by canonical categoryId (new architecture) or legacy loyverseCategoryId.
  // Note: canonical Category IDs and LoyverseCategory IDs are both CUIDs (cuid())
  // generated independently, so collisions are astronomically unlikely.
  if (categoryFilter !== "ALL") {
    where.OR = [
      { categoryId: categoryFilter },
      { loyverseCategoryId: categoryFilter },
    ];
  }

  if (activeFilter === "ACTIVE") where.isActive = true;
  else if (activeFilter === "INACTIVE") where.isActive = false;

  if (subscriptionFilter === "YES") where.isSubscriptionEligible = true;
  else if (subscriptionFilter === "NO") where.isSubscriptionEligible = false;

  const [products, total, activeCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        basePrice: true,
        isActive: true,
        isVisible: true,
        soldOut: true,
        status: true,
        isSubscriptionEligible: true,
        displayOrder: true,
        sortOrder: true,
        updatedAt: true,
        // Canonical category (new architecture)
        category: {
          select: { id: true, name: true },
        },
        // Legacy Loyverse category (fallback)
        loyverseCategory: {
          select: { name: true },
        },
        // Channel mapping status
        channelMapping: {
          where: { channel: "LOYVERSE" },
          select: { status: true, lastSyncAt: true },
        },
        optionGroupAssignments: {
          select: { optionGroupId: true },
        },
      },
    }),
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600 transition-colors">
              Admin Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Product Management</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Canonical product list. Loyverse-linked structure is mirrored automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/products/new"
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors whitespace-nowrap"
          >
            + Add New Product
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">All Products</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">Active Products</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Inactive Products</p>
          <p className="text-2xl font-bold text-gray-600 mt-1">{total - activeCount}</p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <ProductFilters />
      </Suspense>

      {/* Results info */}
      <div className="text-sm text-gray-500">
        {hasFilters ? (
          <>
            Search results <strong className="text-gray-700">{products.length}</strong>
            <span className="text-gray-400"> (All {total})</span>
          </>
        ) : (
          <>
            All <strong className="text-gray-700">{products.length}</strong> Products
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">
              {hasFilters ? "No search results" : "No products registered"}
            </p>
            <p className="text-sm mt-1">
              {hasFilters ? "Try changing your filter conditions." : "Try adding new Products."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Channel</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Modifiers</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Price</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Visible</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Sold Out</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Last Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  // Prefer canonical category, fall back to legacy
                  const categoryLabel =
                    product.category?.name ?? product.loyverseCategory?.name ?? null;
                  const modifierCount = product.optionGroupAssignments.length;
                  const loyverseMapping = product.channelMapping[0];
                  const isLoyverseMapped = !!loyverseMapping;

                  return (
                    <tr key={product.id} className="hover:bg-amber-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="hover:text-amber-600 transition-colors"
                        >
                          {product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {categoryLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                            {categoryLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isLoyverseMapped ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            🔗 Loyverse
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Internal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {modifierCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            {modifierCount}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium tabular-nums">
                        ${product.basePrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.isVisible ? (
                          <span className="text-xs text-green-600">✓</span>
                        ) : (
                          <span className="text-xs text-gray-400">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.soldOut ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Sold Out
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 tabular-nums text-xs">
                        {product.updatedAt.toLocaleDateString("en-NZ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

