"use client";

import { useState, useMemo } from "react";
import type { IngredientRow } from "@/lib/services/ingredientService";

interface AddRecipeItemFormProps {
  productId: string;
  activeIngredients: IngredientRow[];
  existingIngredientIds: string[];
  onAdd: (
    ingredientId: string,
    quantity: number,
    unit: string,
    notes: string | null,
    sortOrder: number
  ) => Promise<void>;
  onCancel: () => void;
}

type FormErrors = Record<string, string | undefined>;

export default function AddRecipeItemForm({
  activeIngredients,
  existingIngredientIds,
  onAdd,
  onCancel,
}: AddRecipeItemFormProps) {
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ingredients not already in the recipe
  const availableIngredients = useMemo(
    () => activeIngredients.filter((i) => !existingIngredientIds.includes(i.id)),
    [activeIngredients, existingIngredientIds]
  );

  const selectedIngredient = activeIngredients.find((i) => i.id === ingredientId);

  // Derived cost preview
  const lineCostPreview = useMemo(() => {
    if (!selectedIngredient || !quantity) return null;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return null;
    const costStr = selectedIngredient.standardUnitCost;
    if (!costStr) return null;
    const cost = parseFloat(costStr);
    return (qty * cost).toFixed(4);
  }, [selectedIngredient, quantity]);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50";
  const errorClass = "text-xs text-red-600 mt-1";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const newErrors: FormErrors = {};
    if (!ingredientId) newErrors.ingredientId = "Please select an ingredient";
    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) newErrors.quantity = "Quantity must be greater than 0";
    if (!selectedIngredient?.standardUnitCost && selectedIngredient) {
      newErrors.ingredientId =
        "This ingredient has no standard unit cost. Update the ingredient first.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onAdd(
        ingredientId,
        qty,
        selectedIngredient!.baseUnit,
        notes.trim() || null,
        parseInt(sortOrder) || 0
      );
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to add ingredient");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        Add Ingredient
      </h3>

      {serverError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>
            Ingredient <span className="text-red-500">*</span>
          </label>
          {availableIngredients.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              All active ingredients are already in this recipe.
            </p>
          ) : (
            <select
              value={ingredientId}
              onChange={(e) => {
                setIngredientId(e.target.value);
                setErrors((prev) => ({ ...prev, ingredientId: undefined }));
              }}
              disabled={submitting}
              className={inputClass}
            >
              <option value="">— Select ingredient —</option>
              {availableIngredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.baseUnit})
                  {i.conversionStatus !== "ok" ? " ⚠ No cost" : ""}
                </option>
              ))}
            </select>
          )}
          {errors.ingredientId && <p className={errorClass}>{errors.ingredientId}</p>}
        </div>

        {selectedIngredient && (
          <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Base unit:</span>
              <span className="font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                {selectedIngredient.baseUnit}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Standard cost:</span>
              {selectedIngredient.standardUnitDisplay ? (
                <span className="font-mono text-gray-800">{selectedIngredient.standardUnitDisplay}</span>
              ) : (
                <span className="text-amber-600 font-medium">⚠ Unavailable — update ingredient first</span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Quantity <span className="text-red-500">*</span>
              {selectedIngredient && (
                <span className="ml-1 text-gray-400 font-normal">
                  (in {selectedIngredient.baseUnit})
                </span>
              )}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setErrors((prev) => ({ ...prev, quantity: undefined }));
              }}
              disabled={submitting}
              step="0.001"
              min="0.001"
              placeholder="0.000"
              className={inputClass}
            />
            {errors.quantity && <p className={errorClass}>{errors.quantity}</p>}
          </div>

          <div>
            <label className={labelClass}>Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              disabled={submitting}
              min="0"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            placeholder="Optional notes..."
            className={inputClass}
          />
        </div>

        {/* Line cost preview */}
        {lineCostPreview && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-amber-700">Estimated line cost:</span>
            <span className="font-mono font-semibold text-amber-900">${lineCostPreview}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || availableIngredients.length === 0}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Adding..." : "Add to Recipe"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
