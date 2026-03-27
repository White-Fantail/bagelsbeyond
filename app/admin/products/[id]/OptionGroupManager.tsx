"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ProductOption = {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
  sku: string | null;
  tracksInventory: boolean;
};

type ProductOptionGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  externalMapping?: { externalOptionGroupId: string } | null;
  options: ProductOption[];
};

type AvailableGroup = {
  id: string;
  name: string;
  _count: { options: number };
};

type Props = {
  productId: string;
  initialGroups: ProductOptionGroup[];
};

export default function OptionGroupManager({ productId, initialGroups }: Props) {
  const [groups, setGroups] = useState<ProductOptionGroup[]>(initialGroups);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null);

  // ── Assignment picker state ───────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [assigningGroupId, setAssigningGroupId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState("");

  const assignedIds = new Set(groups.map((g) => g.id));

  const loadAvailableGroups = useCallback(async (search: string) => {
    setPickerLoading(true);
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/modifier-groups${qs}`);
      if (!res.ok) throw new Error("Load failed");
      const { groups: all } = (await res.json()) as { groups: AvailableGroup[] };
      setAvailableGroups(all);
    } catch {
      setAvailableGroups([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showPicker) {
      loadAvailableGroups(pickerSearch);
    }
  }, [showPicker, pickerSearch, loadAvailableGroups]);

  const handleAssign = async (groupId: string) => {
    setAssigningGroupId(groupId);
    setAssignError("");
    try {
      const res = await fetch(`/api/admin/products/${productId}/modifier-group-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || "Link failed");
      }
      const { group } = (await res.json()) as { group: ProductOptionGroup };
      setGroups((prev) => {
        if (prev.some((g) => g.id === group.id)) return prev;
        return [...prev, group].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko")
        );
      });
      setShowPicker(false);
      setPickerSearch("");
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Link failed");
    } finally {
      setAssigningGroupId(null);
    }
  };

  const handleRemove = async (group: ProductOptionGroup) => {
    const confirmed = window.confirm(
      `Remove "${group.name}" group from this product?\n\nThe group itself will not be deleted — only this product's link will be removed.`
    );
    if (!confirmed) return;

    setRemovingGroupId(group.id);
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/modifier-group-assignments/${group.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || "Remove failed");
      }
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemovingGroupId(null);
    }
  };

  const unassignedAvailable = availableGroups.filter((g) => !assignedIds.has(g.id));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Modifier Groups</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            List of modifier groups linked to this product.{" "}
            <Link href="/admin/modifiers" className="text-amber-600 hover:underline">
              Modifier Management
            </Link>
            to create or edit groups and options.
          </p>
        </div>
        {!showPicker && (
          <button
            type="button"
            onClick={() => {
              setShowPicker(true);
              setAssignError("");
            }}
            className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-medium hover:bg-amber-100 transition-colors whitespace-nowrap"
          >
            + Link Group
          </button>
        )}
      </div>

      {/* Assignment picker */}
      {showPicker && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-800">Select Modifier Group</p>
          {assignError && <p className="text-xs text-red-600">❌ {assignError}</p>}
          <input
            type="text"
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            placeholder="Search by group name..."
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {pickerLoading ? (
              <p className="text-xs text-gray-400 text-center py-3">Loading...</p>
            ) : unassignedAvailable.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">
                {pickerSearch ? "No search results" : "No groups available to link"}
              </p>
            ) : (
              unassignedAvailable.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between px-3 py-2 bg-white rounded-md border border-gray-200 hover:border-amber-300 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{g.name}</p>
                    <p className="text-xs text-gray-400">{g._count.options} options</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAssign(g.id)}
                    disabled={assigningGroupId === g.id}
                    className="px-3 py-1 text-xs bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    {assigningGroupId === g.id ? "Connecting..." : "Link"}
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Link href="/admin/modifiers" className="text-xs text-amber-700 hover:underline">
              Create new group in Modifier Management →
            </Link>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => {
                setShowPicker(false);
                setPickerSearch("");
                setAssignError("");
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 && !showPicker && (
        <div className="text-sm text-gray-400 text-center py-6 space-y-2">
          <p>No linked modifier groups.</p>
          <p className="text-xs">
            Use the <strong className="text-amber-600">+ Link Group</strong> button above to link an existing group,
            link, or{" "}
            <Link href="/admin/modifiers" className="text-amber-600 hover:underline">
              Modifier Management
            </Link>
            Create a new group there.
          </p>
        </div>
      )}

      {/* Connected groups (read-only) */}
      <div className="space-y-3">
        {groups.map((group) => {
          const isSynced = group.externalMapping != null;
          const isExpanded = expandedGroupId === group.id;

          return (
            <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <button
                  type="button"
                  className="flex items-center gap-3 flex-wrap text-left flex-1 min-w-0"
                  onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                >
                  <span className="text-gray-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
                  <span className="font-medium text-gray-900 text-sm">{group.name}</span>
                  {isSynced && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                      🔗 Loyverse
                    </span>
                  )}
                  {group.isRequired && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                      Required
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    Select {group.minSelect}~{group.maxSelect} · {group.options.length} options
                  </span>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <Link
                    href="/admin/modifiers"
                    className="px-2.5 py-1 text-xs text-amber-600 border border-amber-200 rounded-md hover:bg-amber-50 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Edit →
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemove(group)}
                    disabled={removingGroupId === group.id}
                    className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {removingGroupId === group.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>

              {/* Options list (collapsible) */}
              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {group.options.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-gray-400">No options</p>
                  ) : (
                    group.options.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span
                            className={
                              option.isActive ? "text-gray-800" : "text-gray-400 line-through"
                            }
                          >
                            {option.name}
                          </span>
                          <span className="text-gray-500 tabular-nums">
                            {option.priceDelta === 0
                              ? "Free"
                              : option.priceDelta > 0
                              ? `+$${option.priceDelta.toFixed(2)}`
                              : `-$${Math.abs(option.priceDelta).toFixed(2)}`}
                          </span>
                          {!option.isActive && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-full">
                              Inactive
                            </span>
                          )}
                          {option.tracksInventory && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                              Inventory Tracking
                            </span>
                          )}
                          {option.sku && (
                            <span className="text-xs text-gray-400">SKU: {option.sku}</span>
                          )}
                        </div>
                        <Link
                          href={`/admin/modifiers/${option.id}`}
                          className="text-xs text-gray-400 hover:text-amber-600 transition-colors flex-shrink-0"
                        >
                          Details →
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
