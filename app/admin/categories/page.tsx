export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { IntegrationSource, ProductCategory } from "@/app/generated/prisma/enums";
import Link from "next/link";
import CatalogSyncButton from "./CatalogSyncButton";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  BAGEL: "베이글",
  SANDWICH: "샌드위치",
  SPREAD: "스프레드",
  DRINK: "음료",
  OTHER: "기타",
};

const CATEGORY_COLORS: Record<ProductCategory, string> = {
  BAGEL: "bg-amber-50 border-amber-200 text-amber-700",
  SANDWICH: "bg-green-50 border-green-200 text-green-700",
  SPREAD: "bg-purple-50 border-purple-200 text-purple-700",
  DRINK: "bg-blue-50 border-blue-200 text-blue-700",
  OTHER: "bg-gray-50 border-gray-200 text-gray-600",
};

export default async function AdminCategoriesPage() {
  await requireAdmin();

  const [products, lastSyncEntry, totalMapped] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        isActive: true,
        externalMappings: {
          where: { source: IntegrationSource.LOYVERSE },
          select: { id: true, lastSyncedAt: true },
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

  // Group products by category
  const byCategory = Object.values(ProductCategory).map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    products: products.filter((p) => p.category === cat),
  }));

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;

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
          <li>카테고리는 Loyverse 카탈로그 동기화 시 자동으로 매핑됩니다 (Bagels → 베이글, Drinks → 음료 등)</li>
          <li>카테고리를 직접 생성하거나 수동으로 관리하지 말고, Loyverse 동기화를 기본으로 사용하세요</li>
          <li>내부 카테고리 값: BAGEL · SANDWICH · SPREAD · DRINK · OTHER</li>
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
            Loyverse에서 상품·카테고리·모디파이어를 가져옵니다. 카테고리 매핑은 이 동기화 시 자동으로 업데이트됩니다.
          </p>
        </div>
        <CatalogSyncButton />
      </div>

      {/* Category breakdown */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900 text-base">카테고리별 상품 현황</h2>
        {byCategory.map(({ category, label, products: catProducts }) => {
          const loyverseCount = catProducts.filter((p) => p.externalMappings.length > 0).length;
          const activeCount = catProducts.filter((p) => p.isActive).length;
          return (
            <div key={category} className={`rounded-xl border p-4 ${CATEGORY_COLORS[category]}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold">{label}</span>
                  <span className="text-xs font-mono bg-white bg-opacity-60 px-1.5 py-0.5 rounded">
                    {category}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span>{catProducts.length}개 상품</span>
                  <span>{activeCount}개 활성</span>
                  {loyverseCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white bg-opacity-60 font-medium">
                      🔗 Loyverse {loyverseCount}개
                    </span>
                  )}
                </div>
              </div>
              {catProducts.length === 0 ? (
                <p className="text-xs opacity-60">이 카테고리에 상품이 없습니다</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {catProducts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/admin/products/${p.id}`}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white bg-opacity-70 hover:bg-opacity-100 transition-all border border-current border-opacity-20 ${
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
        })}
      </div>

      {/* Loyverse category mapping guide */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Loyverse 카테고리 매핑 정책</h2>
        <p className="text-sm text-gray-500">
          Loyverse 카테고리 이름을 내부 카테고리로 자동 변환합니다. 매핑되지 않는 카테고리는{" "}
          <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">OTHER</code>로 분류됩니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-700">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium">Loyverse 카테고리 키워드</th>
                <th className="text-left px-3 py-2 font-medium">내부 카테고리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-3 py-2 font-mono">bagel</td>
                <td className="px-3 py-2">BAGEL (베이글)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">sandwich / wrap / sub / panini</td>
                <td className="px-3 py-2">SANDWICH (샌드위치)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">spread / cream</td>
                <td className="px-3 py-2">SPREAD (스프레드)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">drink / coffee / tea / juice / water</td>
                <td className="px-3 py-2">DRINK (음료)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">(그 외)</td>
                <td className="px-3 py-2">OTHER (기타)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">
          매핑 로직은{" "}
          <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
            lib/integrations/services/catalog-mapper.ts
          </code>{" "}
          의 <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">mapExternalCategory()</code> 에서 관리됩니다.
        </p>
      </div>
    </div>
  );
}
