"use client";

import { useState } from "react";
import type { RecipeItemRow } from "@/lib/services/recipeService";

interface RecipeItemTableProps {
  items: RecipeItemRow[];
  onDelete: (itemId: string) => Promise<void>;
  onUpdate: (itemId: string, quantity: number, notes: string | null, sortOrder: number) => Promise<void>;
}

export default function RecipeItemTable({ items, onDelete, onUpdate }: RecipeItemTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    quantity: string;
    notes: string;
    sortOrder: string;
  }>({ quantity: "", notes: "", sortOrder: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-400 text-sm">No ingredients in this recipe yet.</p>
        <p className="text-gray-400 text-xs mt-1">
          Add ingredients below to calculate the total recipe cost.
        </p>
      </div>
    );
  }

  function startEdit(item: RecipeItemRow) {
    setEditingId(item.id);
    setEditValues({
      quantity: parseFloat(item.quantity).toString(),
      notes: item.notes ?? "",
      sortOrder: item.sortOrder.toString(),
    });
    setEditError(null);
  }

  async function handleSave(item: RecipeItemRow) {
    const qty = parseFloat(editValues.quantity);
    if (isNaN(qty) || qty <= 0) {
      setEditError("Quantity must be greater than 0");
      return;
    }
    setSaving(true);
    setEditError(null);
    await onUpdate(
      item.id,
      qty,
      editValues.notes.trim() || null,
      parseInt(editValues.sortOrder) || 0
    );
    setSaving(false);
    setEditingId(null);
  }

  async function handleDelete(itemId: string) {
    setDeletingId(itemId);
    await onDelete(itemId);
    setDeletingId(null);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ingredient</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Quantity</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Standard Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Line Cost</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Sort</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => {
              const isEditing = editingId === item.id;
              const isDeleting = deletingId === item.id;

              if (isEditing) {
                return (
                  <tr key={item.id} className="bg-amber-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.ingredientName}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={editValues.quantity}
                        onChange={(e) =>
                          setEditValues((v) => ({ ...v, quantity: e.target.value }))
                        }
                        step="0.001"
                        min="0.001"
                        className="w-24 px-2 py-1 border border-amber-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                        {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">
                      {item.ingredientStandardUnitCost
                        ? `$${item.ingredientStandardUnitCost} / ${item.ingredientBaseUnit}`
                        : <span className="text-amber-600">Unavailable</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">—</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={editValues.notes}
                        onChange={(e) =>
                          setEditValues((v) => ({ ...v, notes: e.target.value }))
                        }
                        placeholder="Optional notes"
                        className="w-full px-2 py-1 border border-amber-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={editValues.sortOrder}
                        onChange={(e) =>
                          setEditValues((v) => ({ ...v, sortOrder: e.target.value }))
                        }
                        className="w-16 px-2 py-1 border border-amber-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editError && (
                          <span className="text-xs text-red-600">{editError}</span>
                        )}
                        <button
                          onClick={() => handleSave(item)}
                          disabled={saving}
                          className="text-xs px-3 py-1.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                        >
                          {saving ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                          className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 transition-colors ${isDeleting ? "opacity-40" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{item.ingredientName}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800">
                    {parseFloat(item.quantity).toLocaleString("en-NZ", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 3,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                      {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 text-xs">
                    {item.ingredientStandardUnitCost ? (
                      `$${item.ingredientStandardUnitCost} / ${item.ingredientBaseUnit}`
                    ) : (
                      <span className="text-amber-600 font-sans">Unavailable</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800 text-xs">
                    {item.lineCost ? (
                      `$${item.lineCost}`
                    ) : (
                      <span className="text-amber-600 font-sans text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {item.notes ?? <span className="italic text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">{item.sortOrder}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isDeleting}
                        className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? "..." : "Remove"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-gray-100">
        {items.map((item) => {
          const isDeleting = deletingId === item.id;
          return (
            <div
              key={item.id}
              className={`p-4 space-y-2 ${isDeleting ? "opacity-40" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{item.ingredientName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-sm text-gray-800">
                      {parseFloat(item.quantity).toLocaleString("en-NZ", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 3,
                      })}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                      {item.unit}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {item.lineCost ? (
                    <p className="font-mono font-semibold text-gray-900 text-sm">
                      ${item.lineCost}
                    </p>
                  ) : (
                    <p className="text-amber-600 text-xs">No cost</p>
                  )}
                  {item.ingredientStandardUnitCost && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      @${item.ingredientStandardUnitCost}/{item.ingredientBaseUnit}
                    </p>
                  )}
                </div>
              </div>
              {item.notes && (
                <p className="text-xs text-gray-500">{item.notes}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => startEdit(item)}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={isDeleting}
                  className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {isDeleting ? "..." : "Remove"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
