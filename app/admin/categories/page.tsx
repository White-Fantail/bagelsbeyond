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
              관리자 대시보드
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">카테고리 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">카테고리 관리</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Loyverse 카탈로그 sync 기반으로 상품을 카테고리별로 관리합니다
          </p>
        </div>
      </div>

      {/* Sync policy notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">🔗 Loyverse Sync 기반 카테고리 운영</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 text-xs">
          <li>카테고리는 Loyverse에서 그대로 가져옵니다 — 로컬에서 카테고리를 정의하지 않습니다</li>
          <li>카테고리를 직접 생성하거나 수동으로 관리하지 말고, Loyverse 동기화를 기본으로 사용하세요</li>
          <li>상품은 Loyverse category id 기준으로 연결됩니다</li>
        </ul>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">전체 상품</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">활성 상품</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeProducts}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-600">Loyverse 연동</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{totalMapped}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">마지막 카탈로그 Sync</p>
          <p className="text-sm font-medium text-gray-700 mt-1">
            {lastSyncEntry?.lastSyncedAt
              ? lastSyncEntry.lastSyncedAt.toLocaleString("ko-KR")
              : "없음"}
          </p>
        </div>
      </div>

      {/* Loyverse sync control */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">Loyverse 카탈로그 동기화</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Loyverse에서 상품·카테고리·모디파이어를 가져옵니다. 카테고리는 동기화 시 자동으로 업데이트됩니다.
          </p>
        </div>
        <CatalogSyncButton />
      </div>

      {/* Category breakdown */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900 text-base">카테고리별 상품 현황</h2>
        {loyverseCategories.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            <p>아직 동기화된 카테고리가 없습니다. Loyverse 동기화를 실행하세요.</p>
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
                    <span>{cat.products.length}개 상품</span>
                    <span>{activeCount}개 활성</span>
                    {loyverseCount > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white bg-opacity-60 font-medium">
                        🔗 Loyverse {loyverseCount}개
                      </span>
                    )}
                  </div>
                </div>
                {cat.products.length === 0 ? (
                  <p className="text-xs text-blue-400">이 카테고리에 상품이 없습니다</p>
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
                        {!p.isActive && <span className="text-xs opacity-60">(비활성)</span>}
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
              <span className="text-base font-semibold text-gray-700">카테고리 없음</span>
              <span className="text-xs text-gray-500">{uncategorisedCount}개 상품</span>
            </div>
            <p className="text-xs text-gray-400">
              Loyverse 카테고리에 연결되지 않은 상품입니다. 동기화 후 자동으로 연결됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
