export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { IntegrationSource, ProductCategory } from "@/app/generated/prisma/enums";
import Link from "next/link";
import { Suspense } from "react";
import ProductFilters from "./ProductFilters";

const CATEGORY_LABELS: Record<string, string> = {
  BAGEL: "베이글",
  SANDWICH: "샌드위치",
  SPREAD: "스프레드",
  DRINK: "음료",
  OTHER: "기타",
};

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
  const sourceFilter = sp.source ?? "ALL";
  const activeFilter = sp.isActive ?? "ALL";
  const subscriptionFilter = sp.subscription ?? "ALL";

  const hasFilters = !!(sp.search || sp.category || sp.source || sp.isActive || sp.subscription);

  // Build where clause
  const where: Record<string, unknown> = {};

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  if (categoryFilter !== "ALL" && Object.values(ProductCategory).includes(categoryFilter as ProductCategory)) {
    where.category = categoryFilter as ProductCategory;
  }

  if (activeFilter === "ACTIVE") where.isActive = true;
  else if (activeFilter === "INACTIVE") where.isActive = false;

  if (subscriptionFilter === "YES") where.isSubscriptionEligible = true;
  else if (subscriptionFilter === "NO") where.isSubscriptionEligible = false;

  // Source filter requires joining external mappings
  if (sourceFilter === "LOYVERSE") {
    where.externalMappings = { some: { source: IntegrationSource.LOYVERSE } };
  } else if (sourceFilter === "INTERNAL") {
    where.externalMappings = { none: { source: IntegrationSource.LOYVERSE } };
  }

  const [products, total, activeCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        basePrice: true,
        isActive: true,
        isSubscriptionEligible: true,
        sortOrder: true,
        updatedAt: true,
        externalMappings: {
          where: { source: IntegrationSource.LOYVERSE },
          select: { id: true },
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
              관리자 대시보드
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">상품 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            전체 상품 목록 및 가격·활성 상태를 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/modifiers"
            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Modifier 관리 →
          </Link>
          <Link
            href="/admin/categories"
            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            카테고리 →
          </Link>
          <Link
            href="/admin/products/new"
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors whitespace-nowrap"
          >
            + 새 상품 추가
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">전체 상품</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">활성 상품</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">비활성 상품</p>
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
            검색 결과 <strong className="text-gray-700">{products.length}</strong>개
            <span className="text-gray-400"> (전체 {total}개)</span>
          </>
        ) : (
          <>
            전체 <strong className="text-gray-700">{products.length}</strong>개 상품
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">
              {hasFilters ? "검색 결과가 없습니다" : "등록된 상품이 없습니다"}
            </p>
            <p className="text-sm mt-1">
              {hasFilters ? "필터 조건을 변경해보세요." : "새 상품을 추가해보세요."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">카테고리</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">출처</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">가격</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">활성</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">구독가능</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">정렬순서</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">마지막수정일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const isLoyverseSynced = product.externalMappings.length > 0;
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
                        {CATEGORY_LABELS[product.category] ?? product.category}
                      </td>
                      <td className="px-4 py-3">
                        {isLoyverseSynced ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            🔗 Loyverse
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            내부
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium tabular-nums">
                        ${product.basePrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            비활성
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.isSubscriptionEligible ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            가능
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                            불가
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 tabular-nums">
                        {product.sortOrder}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 tabular-nums text-xs">
                        {product.updatedAt.toLocaleDateString("ko-KR")}
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
