"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MenuProductRow } from "@/lib/services/menuProductService";
import type { RecipeCostSummary } from "@/lib/services/recipeService";
import type { IngredientRow } from "@/lib/services/ingredientService";
import AddRecipeItemForm from "./AddRecipeItemForm";
import RecipeItemTable from "./RecipeItemTable";

interface RecipeManagerProps {
  product: MenuProductRow;
  initialSummary: RecipeCostSummary | null;
  activeIngredients: IngredientRow[];
}

export default function RecipeManager({
  product,
  initialSummary,
  activeIngredients,
}: RecipeManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<RecipeCostSummary | null>(initialSummary);
  const [recipeName, setRecipeName] = useState(
    initialSummary?.recipe.name ?? `${product.name} Recipe`
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
        body: JSON.stringify({ name: recipeName }),
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
        body: JSON.stringify({ name: newName }),
      });
      await refreshSummary();
    } catch {
      // silently fail — user can retry
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

  async function handleAddItem(ingredientId: string, quantity: number, unit: string, notes: string | null, sortOrder: number) {
    const res = await fetch(`/api/admin/products/${product.id}/recipe/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredientId, quantity, unit, notes, sortOrder }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message ?? "Failed to add ingredient");
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
  const { recipe, items, directTotalCost, adjustedTotalCost, isFullyCosted } = summary;

  return (
    <div className="space-y-6">
      {/* Recipe info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <RecipeNameEditor
              name={recipe.name}
              onSave={handleUpdateRecipeName}
            />
            <p className="text-xs text-gray-400 mt-0.5">
              {items.length} ingredient{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-start gap-6">
            {/* Direct Total */}
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-0.5">Direct Cost</p>
              {directTotalCost ? (
                <p className="text-xl font-semibold text-gray-700">${directTotalCost}</p>
              ) : items.length > 0 && !isFullyCosted ? (
                <p className="text-sm font-semibold text-amber-600">Incomplete</p>
              ) : (
                <p className="text-sm text-gray-400 italic">—</p>
              )}
            </div>
            {/* Adjusted Total */}
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-0.5">Adjusted Cost</p>
              {adjustedTotalCost ? (
                <p className="text-2xl font-bold text-gray-900">${adjustedTotalCost}</p>
              ) : items.length > 0 && !isFullyCosted ? (
                <div>
                  <p className="text-sm font-semibold text-amber-600">Incomplete costing</p>
                  <p className="text-xs text-gray-400">Some ingredients have no standard cost</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No ingredients yet</p>
              )}
              {adjustedTotalCost && directTotalCost && adjustedTotalCost !== directTotalCost && (
                <p className="text-xs text-orange-600 mt-0.5">
                  +${(parseFloat(adjustedTotalCost) - parseFloat(directTotalCost)).toFixed(4)} yield loss
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recipe items table */}
      <RecipeItemTable
        items={items}
        onDelete={handleDeleteItem}
        onUpdate={handleUpdateItem}
      />

      {/* Add ingredient */}
      {showAddForm ? (
        <AddRecipeItemForm
          productId={product.id}
          activeIngredients={activeIngredients}
          existingIngredientIds={items.map((i) => i.ingredientId)}
          onAdd={handleAddItem}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          + Add Ingredient
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
