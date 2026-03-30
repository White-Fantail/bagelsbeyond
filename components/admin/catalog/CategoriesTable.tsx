"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CategoryWithMapping } from "@/lib/catalog/queries/categories";
import SourceBadge from "./SourceBadge";

interface CategoriesTableProps {
  categories: CategoryWithMapping[];
}

function MappingStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    UNMAPPED: "bg-yellow-100 text-yellow-700",
    ERROR: "bg-red-100 text-red-700",
    DISABLED: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function CategoriesTable({ categories }: CategoriesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function callPatch(id: string, payload: { sortOrder?: number; isVisible?: boolean }) {
    setActionId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/catalog/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "Update failed" });
      } else {
        setMessage({ type: "success", text: "Changes saved" });
        startTransition(() => router.refresh());
      }
    } catch {
      setMessage({ type: "error", text: "Failed to connect to server" });
    } finally {
      setActionId(null);
    }
  }

  function handleVisibleToggle(cat: CategoryWithMapping) {
    callPatch(cat.id, { isVisible: !cat.isVisible });
  }

  function handleOrderChange(id: string, value: string) {
    setEditingOrder((prev) => ({ ...prev, [id]: value }));
  }

  function handleOrderSave(id: string) {
    const raw = editingOrder[id];
    if (raw === undefined) return;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 0) {
      setMessage({ type: "error", text: "Display order must be a non-negative integer" });
      return;
    }
    callPatch(id, { sortOrder: parsed });
    setEditingOrder((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const isLoading = isPending || actionId !== null;

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm font-medium">No categories found</p>
        <p className="text-gray-400 text-xs mt-1">Sync from Loyverse to populate catalog data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Order</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mapping</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Synced</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Visible</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((cat) => {
                const isActing = actionId === cat.id;
                const editVal = editingOrder[cat.id];
                const displayOrder = editVal !== undefined ? editVal : String(cat.sortOrder);

                return (
                  <tr
                    key={cat.id}
                    className={`hover:bg-gray-50 transition-colors ${isActing ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={displayOrder}
                          min={0}
                          onChange={(e) => handleOrderChange(cat.id, e.target.value)}
                          onBlur={() => handleOrderSave(cat.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleOrderSave(cat.id);
                            if (e.key === "Escape") {
                              setEditingOrder((prev) => {
                                const next = { ...prev };
                                delete next[cat.id];
                                return next;
                              });
                            }
                          }}
                          disabled={isLoading}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                          aria-label={`Display order for ${cat.name}`}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {cat.color && (
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        <span className="font-medium text-gray-900">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge channel={cat.sourceChannel} sourceRef={cat.sourceRef} />
                    </td>
                    <td className="px-4 py-3">
                      <MappingStatusBadge status={cat.mappingStatus} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {cat.syncedAt
                        ? new Date(cat.syncedAt).toLocaleDateString("en-NZ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleVisibleToggle(cat)}
                        disabled={isLoading}
                        role="switch"
                        aria-checked={cat.isVisible}
                        aria-label={`Toggle visibility for ${cat.name}`}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                          cat.isVisible ? "bg-amber-500" : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                            cat.isVisible ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                      {cat.updatedAt
                        ? new Date(cat.updatedAt).toLocaleDateString("en-NZ")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
