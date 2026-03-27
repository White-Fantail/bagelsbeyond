export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import Link from "next/link";
import { Suspense } from "react";
import ModifierFilters from "./ModifierFilters";
import ModifierSyncButton from "./ModifierSyncButton";
import ModifierGroupList from "./ModifierGroupList";
import ModifierGroupManager from "./ModifierGroupManager";
import type { ModifierGroupRow } from "./ModifierGroupList";
import type { EditableModifierGroup } from "./ModifierGroupManager";

type SearchParams = {
  search?: string;
  groupId?: string;
  source?: string;
  tracksInventory?: string;
  isActive?: string;
};

export default async function AdminModifiersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // ── Build group-level where clause ──────────────────────────────────────────
  const groupWhere: Record<string, unknown> = {};

  if (sp.groupId) groupWhere.id = sp.groupId;

  if (sp.source === "LOYVERSE") {
    groupWhere.externalMapping = { isNot: null };
  } else if (sp.source === "INTERNAL") {
    groupWhere.externalMapping = null;
  }

  // Option-level filters (filter groups that have at least one matching option)
  const optionWhere: Record<string, unknown> = {};
  if (sp.search?.trim()) optionWhere.name = { contains: sp.search.trim(), mode: "insensitive" };
  if (sp.isActive === "ACTIVE") optionWhere.isActive = true;
  else if (sp.isActive === "INACTIVE") optionWhere.isActive = false;
  if (sp.tracksInventory === "YES") optionWhere.tracksInventory = true;
  else if (sp.tracksInventory === "NO") optionWhere.tracksInventory = false;

  // If option-level filters are set, narrow to groups containing matching options
  if (Object.keys(optionWhere).length > 0) {
    groupWhere.options = { some: optionWhere };
  }

  const hasFilters = !!(sp.search || sp.groupId || sp.source || sp.tracksInventory || sp.isActive);

  const [rawGroups, allGroups, lastFullSync] = await Promise.all([
    // Groups matching the filter
    prisma.productOptionGroup.findMany({
      where: groupWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        minSelect: true,
        maxSelect: true,
        isRequired: true,
        sortOrder: true,
        updatedAt: true,
        product: { select: { id: true, name: true } },
        assignments: { include: { product: { select: { id: true, name: true } } } },
        externalMapping: {
          select: { externalOptionGroupId: true, lastSyncedAt: true },
        },
        options: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            priceDelta: true,
            isActive: true,
            tracksInventory: true,
            sortOrder: true,
            sku: true,
            externalOptionMappings: {
              where: { source: IntegrationSource.LOYVERSE },
              select: { externalOptionId: true, lastSyncedAt: true },
            },
            dailyOptionInventory: {
              where: { date: today },
              select: { reservedQty: true, isSoldOut: true },
            },
          },
        },
      },
    }),
    // All groups for the filter dropdown
    prisma.productOptionGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Latest full sync status
    prisma.loyverseFullSyncLog.findFirst({
      orderBy: { syncedAt: "desc" },
      select: {
        syncedAt: true,
        status: true,
        modifierGroupsUpserted: true,
        modifierOptionsUpserted: true,
        modifierLinksUpdated: true,
        errorMessage: true,
      },
    }),
  ]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalGroups = allGroups.length;
  const totalOptions = rawGroups.reduce((s, g) => s + g.options.length, 0);
  const syncedGroupCount = rawGroups.filter((g) => g.externalMapping !== null).length;
  const tracksInventoryCount = rawGroups.reduce(
    (s, g) => s + g.options.filter((o) => o.tracksInventory).length,
    0
  );

  // ── Serialise for client components ──────────────────────────────────────
  const groups: ModifierGroupRow[] = rawGroups.map((g) => {
    const primaryProduct = g.product;
    const allProducts = [
      ...(primaryProduct ? [primaryProduct] : []),
      ...g.assignments
        .map((a) => a.product)
        .filter((p) => !primaryProduct || p.id !== primaryProduct.id),
    ];
    return {
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      isRequired: g.isRequired,
      updatedAt: g.updatedAt.toISOString(),
      product: primaryProduct ?? { id: "", name: "–" },
      sharedProducts: allProducts.slice(1),
      externalMapping: g.externalMapping
        ? {
            externalOptionGroupId: g.externalMapping.externalOptionGroupId,
            lastSyncedAt: g.externalMapping.lastSyncedAt?.toISOString() ?? null,
          }
        : null,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: o.priceDelta,
        isActive: o.isActive,
        tracksInventory: o.tracksInventory,
        sortOrder: o.sortOrder,
        sku: o.sku,
        externalOptionMappings: o.externalOptionMappings.map((m) => ({
          externalOptionId: m.externalOptionId,
          lastSyncedAt: m.lastSyncedAt?.toISOString() ?? null,
        })),
        todayInventory: o.dailyOptionInventory[0]
          ? {
              reservedQty: o.dailyOptionInventory[0].reservedQty,
              isSoldOut: o.dailyOptionInventory[0].isSoldOut,
            }
          : null,
      })),
    };
  });

  const editableGroups: EditableModifierGroup[] = rawGroups.map((g) => ({
    id: g.id,
    name: g.name,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    isRequired: g.isRequired,
    sortOrder: g.sortOrder,
    isLoyverseSynced: g.externalMapping !== null,
    options: g.options.map((o) => ({
      id: o.id,
      name: o.name,
      priceDelta: o.priceDelta,
      isActive: o.isActive,
      tracksInventory: o.tracksInventory,
      sortOrder: o.sortOrder,
      sku: o.sku,
      isLoyverseSynced: o.externalOptionMappings.length > 0,
    })),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-amber-600">관리자 대시보드</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">모디파이어 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">모디파이어 관리</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            모디파이어 그룹과 옵션을 생성·수정하고, 상품에서 연결할 수 있습니다
          </p>
        </div>
        <Link href="/admin/inventory" className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 whitespace-nowrap">
          재고 관리 →
        </Link>
      </div>

      {/* Last full sync status */}
      {lastFullSync ? (
        <div
          className={`rounded-lg border p-4 text-sm space-y-1 ${
            lastFullSync.status === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : lastFullSync.status === "partial"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p className="font-semibold">
            {lastFullSync.status === "success"
              ? "✓ Loyverse 마지막 전체 동기화 성공"
              : lastFullSync.status === "partial"
              ? "⚠ Loyverse 마지막 전체 동기화 부분 완료"
              : "✗ Loyverse 마지막 전체 동기화 실패"}
          </p>
          <p className="text-xs">
            {lastFullSync.syncedAt.toLocaleString("ko-KR")}
            {lastFullSync.status !== "failed" && (
              <> · 그룹 {lastFullSync.modifierGroupsUpserted}개 · 옵션 {lastFullSync.modifierOptionsUpserted}개 · 링크 {lastFullSync.modifierLinksUpdated}건</>
            )}
            {lastFullSync.errorMessage && (
              <span className="text-red-600 ml-2 font-mono">{lastFullSync.errorMessage}</span>
            )}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">⚠ 동기화 이력 없음</p>
          <p className="text-xs mt-0.5">아직 Loyverse 전체 동기화가 실행된 적 없습니다. 아래 버튼으로 동기화하세요.</p>
        </div>
      )}

      {/* Shared-inventory notice */}
      <div className="rounded-lg border border-purple-100 bg-purple-50 p-4 text-sm text-purple-800">
        <p className="font-semibold">💡 Modifier는 공용 재고 단위입니다</p>
        <p className="text-xs mt-0.5">
          <code className="bg-purple-100 rounded px-1">tracksInventory=true</code>인 Modifier Option은 여러 상품에서 공유되어도 재고는 옵션 1개 기준으로만 관리됩니다.
          예: &quot;Plain Bagel&quot; 옵션이 베이글 상품·샌드위치 상품에 모두 사용되어도 DailyOptionInventory는 하나만 존재합니다.
        </p>
      </div>

      {/* Modifier sync button */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Loyverse 전체 동기화</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            카테고리·모디파이어 그룹·옵션·상품을 한 번에 동기화합니다.
            상품과 모디파이어 그룹의 연결 관계도 같이 업데이트됩니다.
          </p>
        </div>
        <ModifierSyncButton />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">전체 그룹</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalGroups}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-600">Loyverse Sync</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{syncedGroupCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-100 p-4">
          <p className="text-xs text-purple-600">재고추적 옵션</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{tracksInventoryCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">전체 옵션</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{totalOptions}</p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <ModifierFilters groups={allGroups} />
      </Suspense>

      {/* Result count */}
      <div className="text-sm text-gray-500">
        {hasFilters ? (
          <>
            검색 결과 <strong className="text-gray-700">{groups.length}</strong>개 그룹
            {" "}(<strong className="text-gray-700">{totalOptions}</strong>개 옵션)
            {" "}<span className="text-gray-400">(전체 {totalGroups}개 그룹)</span>
          </>
        ) : (
          <>
            전체 <strong className="text-gray-700">{groups.length}</strong>개 그룹
            {" "}· <strong className="text-gray-700">{totalOptions}</strong>개 옵션
          </>
        )}
      </div>

      {/* Modifier group management (create/edit/delete for internal groups) */}
      <ModifierGroupManager initialGroups={editableGroups} />

      {/* Read-only overview table (shown as reference; expandable rows) */}
      {hasFilters && <ModifierGroupList groups={groups} />}
    </div>
  );
}
