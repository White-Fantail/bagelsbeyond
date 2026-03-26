export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import Link from "next/link";
import { Suspense } from "react";
import ModifierFilters from "./ModifierFilters";

type SearchParams = { search?: string; groupId?: string; source?: string; tracksInventory?: string; isActive?: string };

export default async function AdminModifiersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;

  const where: Record<string, unknown> = {};
  if (sp.search?.trim()) where.name = { contains: sp.search.trim(), mode: "insensitive" };
  if (sp.groupId) where.optionGroupId = sp.groupId;
  if (sp.isActive === "ACTIVE") where.isActive = true;
  else if (sp.isActive === "INACTIVE") where.isActive = false;
  if (sp.tracksInventory === "YES") where.tracksInventory = true;
  else if (sp.tracksInventory === "NO") where.tracksInventory = false;
  if (sp.source === "LOYVERSE") where.externalOptionMappings = { some: { source: IntegrationSource.LOYVERSE } };
  else if (sp.source === "INTERNAL") where.externalOptionMappings = { none: { source: IntegrationSource.LOYVERSE } };

  const hasFilters = !!(sp.search || sp.groupId || sp.source || sp.tracksInventory || sp.isActive);

  const [options, groups, total] = await Promise.all([
    prisma.productOption.findMany({
      where,
      orderBy: [{ optionGroupId: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true, name: true, priceDelta: true, isActive: true, sortOrder: true,
        tracksInventory: true, updatedAt: true,
        optionGroup: { select: { id: true, name: true, product: { select: { id: true, name: true } } } },
        externalOptionMappings: {
          where: { source: IntegrationSource.LOYVERSE },
          select: { id: true, externalOptionId: true, lastSyncedAt: true },
        },
      },
    }),
    prisma.productOptionGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.productOption.count(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600">관리자 대시보드</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Modifier 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Modifier 관리</h1>
          <p className="text-gray-500 mt-0.5 text-sm">ProductOption 기반 Modifier 목록 및 재고추적 설정을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/products" className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap">← 상품 관리</Link>
          <Link href="/admin/inventory" className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 whitespace-nowrap">재고 관리 →</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">전체 Modifier</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">활성</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{options.filter(o => o.isActive).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-100 p-4">
          <p className="text-xs text-purple-600">재고추적</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{options.filter(o => o.tracksInventory).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-600">Loyverse Sync</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{options.filter(o => o.externalOptionMappings.length > 0).length}</p>
        </div>
      </div>

      <Suspense fallback={null}>
        <ModifierFilters groups={groups} />
      </Suspense>

      <div className="text-sm text-gray-500">
        {hasFilters ? <>검색 결과 <strong className="text-gray-700">{options.length}</strong>개 <span className="text-gray-400">(전체 {total}개)</span></> : <>전체 <strong className="text-gray-700">{options.length}</strong>개</>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {options.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">{hasFilters ? "검색 결과가 없습니다" : "등록된 Modifier가 없습니다"}</p>
            <p className="text-sm mt-1">{hasFilters ? "필터 조건을 변경해보세요." : "상품에 옵션 그룹을 추가하면 나타납니다."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">그룹</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상품</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">출처</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">재고추적</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">활성</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">가격차</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">수정일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {options.map((opt) => {
                  const isSynced = opt.externalOptionMappings.length > 0;
                  return (
                    <tr key={opt.id} className="hover:bg-amber-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link href={`/admin/modifiers/${opt.id}`} className="hover:text-amber-600">{opt.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{opt.optionGroup.name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{opt.optionGroup.product.name}</td>
                      <td className="px-4 py-3">
                        {isSynced ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">🔗 Loyverse</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">내부</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {opt.tracksInventory ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">재고추적</span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {opt.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">활성</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">비활성</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                        {opt.priceDelta >= 0 ? `+$${opt.priceDelta.toFixed(2)}` : `-$${Math.abs(opt.priceDelta).toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs tabular-nums">
                        {opt.updatedAt.toLocaleDateString("ko-KR")}
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
