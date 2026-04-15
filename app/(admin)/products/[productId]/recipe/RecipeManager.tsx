"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MenuProductRow } from "@/lib/services/menuProductService";
import type { RecipeCostSummary } from "@/lib/services/recipeService";
import type { IngredientRow } from "@/lib/services/ingredientService";
import { UnitType } from "@/app/generated/prisma/enums";
import AddRecipeItemForm from "./AddRecipeItemForm";
import RecipeItemTable from "./RecipeItemTable";

interface RecipeManagerProps {
  product: MenuProductRow;
  initialSummary: RecipeCostSummary | null;
  activeIngredients: IngredientRow[];
  componentProducts: MenuProductRow[];
}

export default function RecipeManager({
  product,
  initialSummary,
  activeIngredients,
  componentProducts,
}: RecipeManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<RecipeCostSummary | null>(initialSummary);
  const [recipeName, setRecipeName] = useState(
    initialSummary?.recipe.name ?? `${product.name} Recipe`
  );
  const [outputQuantity, setOutputQuantity] = useState(
    initialSummary?.recipe.outputQuantity ?? "1.000"
  );
  const [outputUnit, setOutputUnit] = useState<UnitType>(
    initialSummary?.recipe.outputUnit ?? UnitType.EA
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function refreshSummary() {
    const res = await fetch(`/api/admin/products/${product.id}/recipe`);
    if (res.ok) {
      const data = await res.json();
      setSummary(data.summary);
    }
    startTransition(() => router.refresh());
  }

  async function handleCreateRecipe() {
    setCreateError(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/recipe`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: recipeName,
          outputQuantity: parseFloat(outputQuantity) || 1,
          outputUnit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.message ?? "Failed to create recipe");
        return;
      }
      await refreshSummary();
    } catch {
      setCreateError("Failed to connect to server");
    }
  }

  async function handleUpdateRecipeName(newName: string) {
    try {
      await fetch(`/api/admin/products/${product.id}/recipe`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          outputQuantity: parseFloat(summary?.recipe.outputQuantity ?? "1") || 1,
          outputUnit: summary?.recipe.outputUnit ?? UnitType.EA,
        }),
      });
      await refreshSummary();
    } catch {
      // silently fail — user can retry
    }
  }

  async function handleUpdateBatchOutput(qty: number, unit: UnitType) {
    try {
      await fetch(`/api/admin/products/${product.id}/recipe`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: summary?.recipe.name ?? recipeName,
          outputQuantity: qty,
          outputUnit: unit,
        }),
      });
      await refreshSummary();
    } catch {
      // silently fail
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await fetch(`/api/admin/products/${product.id}/recipe/items/${itemId}`, {
        method: "DELETE",
      });
      await refreshSummary();
    } catch {
      // silently fail
    }
  }

  async function handleUpdateItem(itemId: string, quantity: number, notes: string | null, sortOrder: number) {
    try {
      await fetch(`/api/admin/products/${product.id}/recipe/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, notes, sortOrder }),
      });
      await refreshSummary();
    } catch {
      // silently fail
    }
  }

  async function handleAddItem(
    sourceType: string,
    ingredientId: string | null,
    componentProductId: string | null,
    quantity: number,
    unit: string,
    notes: string | null,
    sortOrder: number
  ) {
    const res = await fetch(`/api/admin/products/${product.id}/recipe/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType, ingredientId, componentProductId, quantity, unit, notes, sortOrder }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message ?? "Failed to add item");
    }
    await refreshSummary();
    setShowAddForm(false);
  }

  // ── No recipe yet ─────────────────────────────────────────────────────────────
  if (!summary) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">No recipe yet</h2>
          <p className="text-gray-400 text-sm mb-6">
            Create a recipe to start tracking ingredient costs for this product.
          </p>

          <div className="max-w-sm mx-auto space-y-3">
            <input
              type="text"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="Recipe name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Output Quantity</label>
                <input
                  type="number"
                  value={outputQuantity}
                  onChange={(e) => setOutputQuantity(e.target.value)}
                  step="0.001"
                  min="0.001"
                  placeholder="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Output Unit</label>
                <select
                  value={outputUnit}
                  onChange={(e) => setOutputUnit(e.target.value as UnitType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {Object.values(UnitType).map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            {createError && (
              <p className="text-xs text-red-600">{createError}</p>
            )}
            <button
              onClick={handleCreateRecipe}
              disabled={isPending || !recipeName.trim()}
              className="w-full px-5 py-2.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              Create Recipe
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Recipe exists ─────────────────────────────────────────────────────────────
  const {
    recipe,
    items,
    batchDirectTotalCost,
    batchAdjustedTotalCost,
    directCostPerOutputUnit,
    adjustedCostPerOutputUnit,
    outputQuantity: batchOutputQty,
    outputUnit: batchOutputUnit,
    isFullyCosted,
  } = summary;

  return (
    <div className="space-y-6">
      {/* Recipe info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <RecipeNameEditor
              name={recipe.name}
              onSave={handleUpdateRecipeName}
            />
            <p className="text-xs text-gray-400 mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-start gap-6 flex-wrap">
            {/* Direct Total */}
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-0.5">Batch Direct Cost</p>
              {batchDirectTotalCost ? (
                <p className="text-xl font-semibold text-gray-700">${batchDirectTotalCost}</p>
              ) : items.length > 0 && !isFullyCosted ? (
                <p className="text-sm font-semibold text-amber-600">Incomplete</p>
              ) : (
                <p className="text-sm text-gray-400 italic">—</p>
              )}
            </div>
            {/* Adjusted Total */}
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-0.5">Batch Adjusted Cost</p>
              {batchAdjustedTotalCost ? (
                <p className="text-2xl font-bold text-gray-900">${batchAdjustedTotalCost}</p>
              ) : items.length > 0 && !isFullyCosted ? (
                <div>
                  <p className="text-sm font-semibold text-amber-600">Incomplete costing</p>
                  <p className="text-xs text-gray-400">Some items have no cost</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No items yet</p>
              )}
              {batchAdjustedTotalCost && batchDirectTotalCost && batchAdjustedTotalCost !== batchDirectTotalCost && (
                <p className="text-xs text-orange-600 mt-0.5">
                  +${(parseFloat(batchAdjustedTotalCost) - parseFloat(batchDirectTotalCost)).toFixed(4)} yield loss
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Batch output + per-unit cost */}
        <div className="border-t border-gray-100 pt-4">
          <BatchOutputEditor
            outputQuantity={parseFloat(batchOutputQty)}
            outputUnit={batchOutputUnit}
            onSave={handleUpdateBatchOutput}
          />
          {adjustedCostPerOutputUnit && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-gray-500">Cost per {batchOutputUnit}:</span>
              <span className="font-bold text-amber-700 text-base">${adjustedCostPerOutputUnit}</span>
              {directCostPerOutputUnit && directCostPerOutputUnit !== adjustedCostPerOutputUnit && (
                <span className="text-xs text-gray-400 font-mono">(direct: ${directCostPerOutputUnit})</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recipe items table */}
      <RecipeItemTable
        items={items}
        onDelete={handleDeleteItem}
        onUpdate={handleUpdateItem}
      />

      {/* Add item */}
      {showAddForm ? (
        <AddRecipeItemForm
          productId={product.id}
          activeIngredients={activeIngredients}
          componentProducts={componentProducts}
          existingIngredientIds={items.filter((i) => i.ingredientId).map((i) => i.ingredientId!)}
          existingComponentProductIds={items.filter((i) => i.componentProductId).map((i) => i.componentProductId!)}
          onAdd={handleAddItem}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          + Add Item
        </button>
      )}
    </div>
  );
}

// ── Inline recipe name editor ──────────────────────────────────────────────────

function RecipeNameEditor({
  name,
  onSave,
}: {
  name: string;
  onSave: (newName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(value.trim());
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setValue(name);
              setEditing(false);
            }
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs text-amber-600 hover:underline"
        >
          Save
        </button>
        <button
          onClick={() => {
            setValue(name);
            setEditing(false);
          }}
          className="text-xs text-gray-400 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 text-left"
      title="Click to rename recipe"
    >
      <h2 className="text-base font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
        {name}
      </h2>
      <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
        ✏️
      </span>
    </button>
  );
}

// ── Batch output editor ────────────────────────────────────────────────────────

function BatchOutputEditor({
  outputQuantity,
  outputUnit,
  onSave,
}: {
  outputQuantity: number;
  outputUnit: UnitType;
  onSave: (qty: number, unit: UnitType) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(outputQuantity));
  const [unit, setUnit] = useState<UnitType>(outputUnit);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const num = parseFloat(qty);
    if (isNaN(num) || num <= 0) return;
    setSaving(true);
    await onSave(num, unit);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Batch output:</span>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          step="0.001"
          min="0.001"
          className="w-20 px-2 py-1 border border-amber-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          autoFocus
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as UnitType)}
          className="px-2 py-1 border border-amber-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {Object.values(UnitType).map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs text-amber-600 hover:underline"
        >
          Save
        </button>
        <button
          onClick={() => {
            setQty(String(outputQuantity));
            setUnit(outputUnit);
            setEditing(false);
          }}
          className="text-xs text-gray-400 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 text-left"
      title="Click to edit batch output"
    >
      <span className="text-xs text-gray-500">Batch output:</span>
      <span className="text-sm font-semibold text-gray-700 group-hover:text-amber-700 transition-colors">
        {outputQuantity} {outputUnit}
      </span>
      <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
        ✏️
      </span>
    </button>
  );
}
