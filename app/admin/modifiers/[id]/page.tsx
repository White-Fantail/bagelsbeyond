export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import Link from "next/link";
import ModifierEditForm from "./ModifierEditForm";

export default async function ModifierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const option = await prisma.productOption.findUnique({
    where: { id },
    include: {
      optionGroup: {
        include: {
          product: { select: { id: true, name: true, category: true } },
          assignments: { include: { product: { select: { id: true, name: true } } } },
        },
      },
      externalOptionMappings: {
        where: { source: IntegrationSource.LOYVERSE },
        select: { id: true, externalOptionId: true, externalName: true, externalGroupId: true, externalGroupName: true, lastSyncedAt: true },
      },
      dailyOptionInventory: {
        where: { date: today },
        select: { id: true, plannedQty: true, reservedQty: true, soldQty: true, isSoldOut: true, note: true },
      },
    },
  });

  if (!option) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600">관리자 대시보드</Link>
          <span>/</span>
          <Link href="/admin/modifiers" className="hover:text-amber-600">Modifier 관리</Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-lg font-medium text-gray-700">Modifier를 찾을 수 없습니다</p>
          <Link href="/admin/modifiers" className="mt-4 inline-block px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const isLoyverseSynced = option.externalOptionMappings.length > 0;
  const mapping = option.externalOptionMappings[0];
  const todayInventory = option.dailyOptionInventory[0] ?? null;

  // Collect all products connected via group (direct + assignments)
  const directProduct = option.optionGroup.product;
  const assignedProducts = option.optionGroup.assignments.map((a) => a.product);
  const allProducts = [
    ...(directProduct ? [directProduct] : []),
    ...assignedProducts.filter((p) => !directProduct || p.id !== directProduct.id),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600">관리자 대시보드</Link>
            <span>/</span>
            <Link href="/admin/modifiers" className="hover:text-amber-600">Modifier 관리</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">{option.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{option.name}</h1>
          <p className="text-gray-500 mt-0.5 text-sm">그룹: {option.optionGroup.name}</p>
        </div>
        <Link href="/admin/modifiers" className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">← 목록</Link>
      </div>

      {/* Loyverse badge */}
      {isLoyverseSynced && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <span className="text-lg leading-none">🔗</span>
          <div>
            <p className="font-semibold">Synced from Loyverse</p>
            <p className="mt-0.5 text-blue-700">이름·가격은 Loyverse 원본 필드로 수정 불가입니다. 내부 운영 필드(재고추적, 활성, 정렬)만 수정 가능합니다.</p>
            {mapping && (
              <p className="mt-1 text-xs font-mono text-blue-600">
                Loyverse ID: {mapping.externalOptionId}
                {mapping.lastSyncedAt && <> · 마지막 sync: {new Date(mapping.lastSyncedAt).toLocaleString("ko-KR")}</>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Read-only info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h2 className="font-semibold text-gray-900">원본 정보</h2>
          {isLoyverseSynced && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">🔒 Loyverse 원본 (수정 불가)</span>}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">이름</p>
            <p className="font-medium text-gray-900">{option.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">가격차</p>
            <p className="font-medium text-gray-900">{option.priceDelta >= 0 ? `+$${option.priceDelta.toFixed(2)}` : `-$${Math.abs(option.priceDelta).toFixed(2)}`}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">그룹</p>
            <p className="text-gray-700">{option.optionGroup.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">SKU</p>
            <p className="text-gray-700">{option.sku ?? "-"}</p>
          </div>
        </div>
      </div>

      {/* Today's inventory (if tracksInventory) */}
      {option.tracksInventory && (
        <div className="bg-white rounded-xl border border-purple-200 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">재고추적</span>
              오늘 재고 현황
            </h2>
            <Link href="/admin/inventory" className="text-xs text-amber-600 hover:underline">재고 관리 페이지 →</Link>
          </div>
          {todayInventory ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">계획수량</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{todayInventory.plannedQty}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">예약수량</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{todayInventory.reservedQty}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">판매수량</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{todayInventory.soldQty}</p>
              </div>
              <div className={`rounded-lg p-3 ${todayInventory.isSoldOut ? "bg-red-50" : "bg-green-50"}`}>
                <p className="text-xs text-gray-500">품절</p>
                <p className={`text-xl font-bold mt-0.5 ${todayInventory.isSoldOut ? "text-red-600" : "text-green-600"}`}>
                  {todayInventory.isSoldOut ? "품절" : "재고있음"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">오늘 재고 데이터가 없습니다.</p>
          )}
        </div>
      )}

      {/* Editable fields */}
      <ModifierEditForm
        id={option.id}
        tracksInventory={option.tracksInventory}
        isActive={option.isActive}
        sortOrder={option.sortOrder}
        sku={option.sku ?? ""}
        isLoyverseSynced={isLoyverseSynced}
      />

      {/* Connected products */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">연결된 상품</h2>
        <ul className="space-y-2">
          {allProducts.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="text-sm text-amber-600 hover:underline">{p.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
