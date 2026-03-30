"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemWithMapping } from "@/lib/catalog/queries/items";
import type { ItemModifierGroupDetail } from "@/lib/catalog/queries/items";
import SourceBadge from "./SourceBadge";

interface ItemsTableProps {
  items: ItemWithMapping[];
}

function ItemDetailModal({
  item,
  onClose,
}: {
  item: ItemWithMapping;
  onClose: () => void;
}) {
  const [modGroups, setModGroups] = useState<ItemModifierGroupDetail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadModifiers() {
    if (modGroups !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/catalog/items/${item.id}/modifiers`);
      if (!res.ok) throw new Error("Failed to load modifier groups");
      const data: ItemModifierGroupDetail[] = await res.json();
      setModGroups(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
            {item.categoryName && (
              <p className="text-xs text-gray-500 mt-0.5">Category: {item.categoryName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Price</p>
            <p className="font-medium text-gray-900">
              {item.basePrice ? `$${item.basePrice}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">SKU</p>
            <p className="font-medium text-gray-900">{item.sku ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Visible</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.isVisible ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {item.isVisible ? "Yes" : "No"}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Active</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {item.isActive ? "Yes" : "No"}
            </span>
          </div>
          {item.sourceChannel && (
            <>
              <div>
                <p className="text-xs text-gray-500">Source</p>
                <p className="font-medium text-blue-700">{item.sourceChannel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Source Ref</p>
                <p className="font-mono text-xs text-gray-600 truncate" title={item.sourceRef ?? ""}>
                  {item.sourceRef ?? "—"}
                </p>
              </div>
            </>
          )}
          {item.syncedAt && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Last Synced</p>
              <p className="text-xs text-gray-600">
                {new Date(item.syncedAt).toLocaleString("en-NZ")}
              </p>
            </div>
          )}
        </div>

        {item.description && (
          <div>
            <p className="text-xs text-gray-500">Description</p>
            <p className="text-sm text-gray-700 mt-0.5">{item.description}</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">
              Modifier Groups ({item.modifierGroupCount})
            </p>
            {modGroups === null && (
              <button
                onClick={loadModifiers}
                disabled={loading}
                className="text-xs px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load Modifiers"}
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {modGroups !== null && modGroups.length === 0 && (
            <p className="text-xs text-gray-400">No modifier groups linked.</p>
          )}
          {modGroups !== null && modGroups.length > 0 && (
            <ul className="space-y-1.5">
              {modGroups.map((g) => (
                <li key={g.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium text-gray-800">{g.name}</span>
                  <span className="text-gray-500">{g.optionCount} options</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ItemsTable({ items }: ItemsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemWithMapping | null>(null);

  async function callPatch(id: string, payload: { isVisible?: boolean; isActive?: boolean }) {
    setActionId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/catalog/items/${id}`, {
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

  const isLoading = isPending || actionId !== null;

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm font-medium">No items found</p>
        <p className="text-gray-400 text-xs mt-1">Sync from Loyverse to populate catalog data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Modifiers</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Synced</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Visible</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => {
                const isActing = actionId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 transition-colors ${isActing ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-8 h-8 rounded object-cover flex-shrink-0 bg-gray-100"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-400 text-xs">🥯</span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.categoryName ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {item.categoryName}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {item.basePrice ? `$${item.basePrice}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.modifierGroupCount > 0 ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400"}`}>
                        {item.modifierGroupCount} group{item.modifierGroupCount !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                    <SourceBadge channel={item.sourceChannel} sourceRef={item.sourceRef} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {item.syncedAt
                        ? new Date(item.syncedAt).toLocaleDateString("en-NZ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => callPatch(item.id, { isVisible: !item.isVisible })}
                        disabled={isLoading}
                        role="switch"
                        aria-checked={item.isVisible}
                        aria-label={`Toggle visibility for ${item.name}`}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                          item.isVisible ? "bg-amber-500" : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                            item.isVisible ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                        aria-label={`View details for ${item.name}`}
                      >
                        Details
                      </button>
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
