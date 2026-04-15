"use client";

import { useState, useEffect, useRef } from "react";
import type { RecipeItemRow } from "@/lib/services/recipeService";
import { RecipeItemSourceType } from "@/app/generated/prisma/enums";

interface RecipeItemTableProps {
  items: RecipeItemRow[];
  onDelete: (itemId: string) => Promise<void>;
  onUpdate: (itemId: string, quantity: number, notes: string | null, sortOrder: number) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

export default function RecipeItemTable({ items, onDelete, onUpdate, onReorder }: RecipeItemTableProps) {
  const [localItems, setLocalItems] = useState<RecipeItemRow[]>(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    quantity: string;
    notes: string;
  }>({ quantity: "", notes: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draggedIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-400 text-sm">No items in this recipe yet.</p>
        <p className="text-gray-400 text-xs mt-1">
          Add ingredients or product components below to calculate the total recipe cost.
        </p>
      </div>
    );
  }

  function startEdit(item: RecipeItemRow) {
    setEditingId(item.id);
    setEditValues({
      quantity: parseFloat(item.quantity).toString(),
      notes: item.notes ?? "",
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
      item.sortOrder
    );
    setSaving(false);
    setEditingId(null);
  }

  function handleDragStart(index: number) {
    draggedIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDragLeave() {
    setDragOverIndex(null);
  }

  function handleDrop(index: number) {
    const from = draggedIndexRef.current;
    if (from === null || from === index) {
      draggedIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }
    const newItems = [...localItems];
    const [moved] = newItems.splice(from, 1);
    newItems.splice(index, 0, moved);
    setLocalItems(newItems);
    draggedIndexRef.current = null;
    setDragOverIndex(null);
    onReorder(newItems.map((item) => item.id));
  }

  function handleDragEnd() {
    draggedIndexRef.current = null;
    setDragOverIndex(null);
  }

  async function handleDelete(itemId: string) {
    setDeletingId(itemId);
    await onDelete(itemId);
    setDeletingId(null);
  }

  function getItemDisplayName(item: RecipeItemRow): string {
    if (item.sourceType === RecipeItemSourceType.INGREDIENT) {
      return item.ingredientName ?? "Unknown Ingredient";
    }
    return item.componentProductName ?? "Unknown Product";
  }

  function getItemSourceBadge(item: RecipeItemRow) {
    if (item.sourceType === RecipeItemSourceType.PRODUCT) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 ml-1">
          component
        </span>
      );
    }
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-8 px-2 py-3"></th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Quantity</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Yield %</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Effective Qty</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Unit Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Direct Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Adjusted Cost</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {localItems.map((item, index) => {
              const isEditing = editingId === item.id;
              const isDeleting = deletingId === item.id;
              const isProductItem = item.sourceType === RecipeItemSourceType.PRODUCT;
              const isDragOver = dragOverIndex === index;

              if (isEditing) {
                return (
                  <tr key={item.id} className="bg-amber-50">
                    <td className="px-2 py-3 text-gray-300 text-center">⠿</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {getItemDisplayName(item)}{getItemSourceBadge(item)}
                    </td>
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
                      {isProductItem ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span className={item.yieldPercent && parseFloat(item.yieldPercent) < 100 ? "text-amber-700 font-medium" : ""}>
                          {item.yieldPercent}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">—</td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">
                      {isProductItem ? (
                        item.componentProductUnitCost ? (
                          `$${item.componentProductUnitCost} / EA`
                        ) : (
                          <span className="text-amber-600">No cost</span>
                        )
                      ) : (
                        item.ingredientStandardUnitCost ? (
                          `$${item.ingredientStandardUnitCost} / ${item.ingredientBaseUnit}`
                        ) : (
                          <span className="text-amber-600">Unavailable</span>
                        )
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">—</td>
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
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`transition-colors ${isDeleting ? "opacity-40" : ""} ${isDragOver ? "bg-amber-50 border-t-2 border-amber-400" : "hover:bg-gray-50"}`}
                >
                  <td className="px-2 py-3 text-gray-300 text-center cursor-grab active:cursor-grabbing select-none">
                    ⠿
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {getItemDisplayName(item)}{getItemSourceBadge(item)}
                  </td>
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
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {isProductItem ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className={item.yieldPercent && parseFloat(item.yieldPercent) < 100 ? "text-amber-700 font-medium" : "text-gray-600"}>
                        {item.yieldPercent}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 text-xs">
                    {item.effectiveQuantity ? (
                      parseFloat(item.effectiveQuantity).toLocaleString("en-NZ", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 3,
                      })
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 text-xs">
                    {isProductItem ? (
                      item.componentProductUnitCost ? (
                        `$${item.componentProductUnitCost} / EA`
                      ) : (
                        <span className="text-amber-600 font-sans">No cost</span>
                      )
                    ) : (
                      item.ingredientStandardUnitCost ? (
                        `$${item.ingredientStandardUnitCost} / ${item.ingredientBaseUnit}`
                      ) : (
                        <span className="text-amber-600 font-sans">Unavailable</span>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 text-xs">
                    {item.directLineCost ? (
                      `$${item.directLineCost}`
                    ) : (
                      <span className="text-amber-600 font-sans text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {item.adjustedLineCost ? (
                      <span className={!isProductItem && item.yieldPercent && parseFloat(item.yieldPercent) < 100 ? "text-orange-700 font-medium" : "text-gray-700"}>
                        ${item.adjustedLineCost}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-sans text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {item.notes ?? <span className="italic text-gray-300">—</span>}
                  </td>
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
        {localItems.map((item, index) => {
          const isDeleting = deletingId === item.id;
          const isProductItem = item.sourceType === RecipeItemSourceType.PRODUCT;
          const isDragOver = dragOverIndex === index;
          return (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`p-4 space-y-2 ${isDeleting ? "opacity-40" : ""} ${isDragOver ? "bg-amber-50 border-t-2 border-amber-400" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-gray-300 text-lg cursor-grab active:cursor-grabbing select-none mt-0.5">⠿</span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {getItemDisplayName(item)}{getItemSourceBadge(item)}
                    </p>
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
                      {!isProductItem && item.yieldPercent && (
                        <span className={`text-xs font-mono ${parseFloat(item.yieldPercent) < 100 ? "text-amber-700 font-medium" : "text-gray-400"}`}>
                          yield {item.yieldPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {item.directLineCost ? (
                    <div>
                      <p className="font-mono text-gray-700 text-xs">Direct: ${item.directLineCost}</p>
                      {item.adjustedLineCost && !isProductItem && item.yieldPercent && parseFloat(item.yieldPercent) < 100 && (
                        <p className="font-mono font-semibold text-orange-700 text-sm">
                          Adj: ${item.adjustedLineCost}
                        </p>
                      )}
                      {item.adjustedLineCost && (isProductItem || !item.yieldPercent || parseFloat(item.yieldPercent) >= 100) && (
                        <p className="font-mono font-semibold text-gray-900 text-sm">
                          ${item.adjustedLineCost}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-amber-600 text-xs">No cost</p>
                  )}
                  {!isProductItem && item.ingredientStandardUnitCost && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      @${item.ingredientStandardUnitCost}/{item.ingredientBaseUnit}
                    </p>
                  )}
                  {isProductItem && item.componentProductUnitCost && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      @${item.componentProductUnitCost}/EA
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
