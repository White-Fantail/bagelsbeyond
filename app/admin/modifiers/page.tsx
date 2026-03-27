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
            <Link href="/admin" className="hover:text-amber-600">Admin Dashboard</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Modifier Management</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Modifier Management</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Create and edit modifier groups and options, and link them to products.
          </p>
        </div>
        <Link href="/admin/inventory" className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 whitespace-nowrap">
          Inventory Management →
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
              ? "✓ Loyverse Last Full Sync successful"
              : lastFullSync.status === "partial"
              ? "⚠ Loyverse Last Full Sync partially complete"
              : "✗ Loyverse Last Full Sync Failed"}
          </p>
          <p className="text-xs">
            {lastFullSync.syncedAt.toLocaleString("en-NZ")}
            {lastFullSync.status !== "failed" && (
              <> · Groups {lastFullSync.modifierGroupsUpserted} · Options {lastFullSync.modifierOptionsUpserted} · Links {lastFullSync.modifierLinksUpdated}</>
            )}
            {lastFullSync.errorMessage && (
              <span className="text-red-600 ml-2 font-mono">{lastFullSync.errorMessage}</span>
            )}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">⚠ No Sync History</p>
          <p className="text-xs mt-0.5">Loyverse Full Sync has never been run. Use the button below to sync.</p>
        </div>
      )}

      {/* Shared-inventory notice */}
      <div className="rounded-lg border border-purple-100 bg-purple-50 p-4 text-sm text-purple-800">
        <p className="font-semibold">💡 Modifiers are shared Inventory units</p>
        <p className="text-xs mt-0.5">
          <code className="bg-purple-100 rounded px-1">tracksInventory=true</code> modifier options are shared across products but have only one Inventory entry.
          E.g. The &quot;Plain Bagel&quot; option used in both bagel and sandwich products has only one DailyOptionInventory entry.
        </p>
      </div>

      {/* Modifier sync button */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Loyverse All Sync</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Sync categories, modifier groups, options, and products all at once..
            Product-modifier group links are also updated..
          </p>
        </div>
        <ModifierSyncButton />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">All groups</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalGroups}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-600">Loyverse Sync</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{syncedGroupCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-100 p-4">
          <p className="text-xs text-purple-600">Inventory Tracking Options</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{tracksInventoryCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600">All Options</p>
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
            Search results <strong className="text-gray-700">{groups.length}</strong> groups
            {" "}(<strong className="text-gray-700">{totalOptions}</strong> options)
            {" "}<span className="text-gray-400">({totalGroups} groups total)</span>
          </>
        ) : (
          <>
            All <strong className="text-gray-700">{groups.length}</strong> groups
            {" "}· <strong className="text-gray-700">{totalOptions}</strong> options
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
