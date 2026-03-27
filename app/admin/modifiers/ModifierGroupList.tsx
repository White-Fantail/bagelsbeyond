"use client";

import Link from "next/link";
import { useState } from "react";

export interface ModifierGroupRow {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  updatedAt: string;
  // Primary product
  product: { id: string; name: string };
  // Additional products sharing this group
  sharedProducts: { id: string; name: string }[];
  // Loyverse mapping
  externalMapping: {
    externalOptionGroupId: string;
    lastSyncedAt: string | null;
  } | null;
  options: {
    id: string;
    name: string;
    priceDelta: number;
    isActive: boolean;
    tracksInventory: boolean;
    sortOrder: number;
    sku: string | null;
    externalOptionMappings: {
      externalOptionId: string;
      lastSyncedAt: string | null;
    }[];
    todayInventory: {
      reservedQty: number;
      isSoldOut: boolean;
    } | null;
  }[];
}

function SourceBadge({ isSynced }: { isSynced: boolean }) {
  if (isSynced) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        🔗 Loyverse
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      Internal
    </span>
  );
}

function OptionRow({ opt }: { opt: ModifierGroupRow["options"][number] }) {
  const isSynced = opt.externalOptionMappings.length > 0;
  const mapping = opt.externalOptionMappings[0];

  return (
    <tr className="bg-amber-50/40 border-b border-amber-100 last:border-0">
      {/* indent */}
      <td className="px-4 py-2 pl-10 text-sm">
        <Link href={`/admin/modifiers/${opt.id}`} className="text-gray-800 hover:text-amber-700 font-medium">
          {opt.name}
        </Link>
        {mapping?.externalOptionId && (
          <span className="ml-2 font-mono text-xs text-gray-400">{mapping.externalOptionId}</span>
        )}
      </td>
      <td className="px-4 py-2 text-sm">
        <SourceBadge isSynced={isSynced} />
      </td>
      <td className="px-4 py-2 text-sm text-center">
        {opt.tracksInventory ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            Inventory Tracking
          </span>
        ) : (
          <span className="text-gray-300 text-xs">-</span>
        )}
      </td>
      <td className="px-4 py-2 text-sm text-center">
        {opt.isActive ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
            Inactive
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-600">
        {opt.priceDelta >= 0 ? `+$${opt.priceDelta.toFixed(2)}` : `-$${Math.abs(opt.priceDelta).toFixed(2)}`}
      </td>
      <td className="px-4 py-2 text-sm text-right">
        {opt.tracksInventory && opt.todayInventory ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${opt.todayInventory.isSoldOut ? "bg-red-100 text-red-700" : "bg-green-100 text-green-600"}`}>
            {opt.todayInventory.isSoldOut ? "Out of Stock" : `Reserved ${opt.todayInventory.reservedQty}`}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">-</span>
        )}
      </td>
      <td className="px-4 py-2 text-sm text-right">
        <div className="flex items-center justify-end gap-2">
          {opt.tracksInventory && (
            <Link href="/admin/inventory" className="text-xs text-amber-600 hover:underline whitespace-nowrap">
              Inventory →
            </Link>
          )}
          <Link href={`/admin/modifiers/${opt.id}`} className="text-xs text-gray-500 hover:text-amber-600 whitespace-nowrap">
            Details
          </Link>
        </div>
      </td>
    </tr>
  );
}

function GroupRow({ group }: { group: ModifierGroupRow }) {
  const [expanded, setExpanded] = useState(false);
  const isSynced = group.externalMapping !== null;
  const allProducts = [group.product, ...group.sharedProducts].filter((p) => p.id !== "");
  const tracksCount = group.options.filter((o) => o.tracksInventory).length;
  const activeCount = group.options.filter((o) => o.isActive).length;

  return (
    <>
      <tr
        className={`border-b border-gray-200 hover:bg-amber-50/50 transition-colors cursor-pointer ${expanded ? "bg-amber-50/30" : ""}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className="text-gray-400 hover:text-amber-600 transition-colors w-5 h-5 flex items-center justify-center rounded"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? "▼" : "▶"}
            </button>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{group.name}</p>
              {isSynced && group.externalMapping && (
                <p className="text-xs text-gray-400 font-mono mt-0.5">{group.externalMapping.externalOptionGroupId}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <SourceBadge isSynced={isSynced} />
          {isSynced && group.externalMapping?.lastSyncedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(group.externalMapping.lastSyncedAt).toLocaleString("en-NZ")}
            </p>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          <div className="space-y-0.5">
            {allProducts.map((p) => (
              <Link
                key={p.id}
                href={`/admin/products/${p.id}`}
                className="block text-xs hover:text-amber-600"
                onClick={(e) => e.stopPropagation()}
              >
                {p.name}
              </Link>
            ))}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-bold text-gray-900">{group.options.length}</span>
            <span className="text-xs text-gray-400">Options</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          {tracksCount > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              {tracksCount} Inventory Tracking
            </span>
          ) : (
            <span className="text-gray-300 text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm text-gray-600">
            {activeCount}/{group.options.length}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-xs text-gray-400">
          {new Date(group.updatedAt).toLocaleDateString("en-NZ")}
        </td>
      </tr>
      {expanded &&
        group.options
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
          .map((opt) => <OptionRow key={opt.id} opt={opt} />)}
    </>
  );
}

export default function ModifierGroupList({ groups }: { groups: ModifierGroupRow[] }) {
  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        <p className="text-lg font-medium">No modifier groups registered</p>
        <p className="text-sm mt-1 text-gray-400">
          Running Loyverse catalog Sync will automatically create Modifier groups.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Group Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Link Products</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Options</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Inventory Tracking</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Last Edit</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRow key={group.id} group={group} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        ▶ Click the button or row to expand the option list.
      </div>
    </div>
  );
}
