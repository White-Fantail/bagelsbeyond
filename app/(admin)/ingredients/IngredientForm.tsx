"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { UnitType } from "@/app/generated/prisma/enums";
import type { IngredientRow, IngredientCategoryRow } from "@/lib/services/ingredientService";
import { getConversionFactor } from "@/lib/costing/unit-conversion";

interface IngredientFormProps {
  ingredient?: IngredientRow;
  categories: IngredientCategoryRow[];
}

const UNIT_OPTIONS = Object.values(UnitType);

type FormErrors = Record<string, string | undefined>;

export default function IngredientForm({ ingredient, categories }: IngredientFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(ingredient?.name ?? "");
  const [categoryId, setCategoryId] = useState(ingredient?.categoryId ?? "");
  const [description, setDescription] = useState(ingredient?.description ?? "");
  const [purchasePrice, setPurchasePrice] = useState(ingredient?.purchasePrice ?? "");
  const [purchaseQuantity, setPurchaseQuantity] = useState(ingredient?.purchaseQuantity ?? "");
  const [purchaseUnit, setPurchaseUnit] = useState<string>(
    ingredient?.purchaseUnit ?? UnitType.KG
  );
  const [baseUnit, setBaseUnit] = useState<string>(ingredient?.baseUnit ?? UnitType.G);
  const [yieldPercent, setYieldPercent] = useState(ingredient?.yieldPercent ?? "100.00");
  const [taxIncluded, setTaxIncluded] = useState(ingredient?.taxIncluded ?? true);
  const [isActive, setIsActive] = useState(ingredient?.isActive ?? true);
  const [notes, setNotes] = useState(ingredient?.notes ?? "");

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isEditing = !!ingredient;

  // Live unit-pair compatibility check for the form UI
  const unitConversionHint = useMemo(() => {
    if (!purchaseUnit || !baseUnit) return null;
    const check = getConversionFactor(purchaseUnit as UnitType, baseUnit as UnitType);
    if (check.canConvert) return null;
    return check.errorMessage;
  }, [purchaseUnit, baseUnit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const payload = {
      name,
      categoryId: categoryId || null,
      description: description || null,
      purchasePrice: parseFloat(purchasePrice as string),
      purchaseQuantity: parseFloat(purchaseQuantity as string),
      purchaseUnit,
      baseUnit,
      yieldPercent: parseFloat(yieldPercent as string),
      taxIncluded,
      isActive,
      notes: notes || null,
    };

    // Client-side validation
    const newErrors: FormErrors = {};
    if (!payload.name.trim()) newErrors.name = "Name is required";
    if (isNaN(payload.purchasePrice) || payload.purchasePrice <= 0)
      newErrors.purchasePrice = "Purchase price must be greater than 0";
    if (isNaN(payload.purchaseQuantity) || payload.purchaseQuantity <= 0)
      newErrors.purchaseQuantity = "Purchase quantity must be greater than 0";
    if (!payload.purchaseUnit) newErrors.purchaseUnit = "Purchase unit is required";
    if (!payload.baseUnit) newErrors.baseUnit = "Base unit is required";
    if (unitConversionHint) newErrors.baseUnit = unitConversionHint;
    if (isNaN(payload.yieldPercent) || payload.yieldPercent <= 0)
      newErrors.yieldPercent = "Yield % must be greater than 0";
    else if (payload.yieldPercent > 100)
      newErrors.yieldPercent = "Yield % must be 100 or less";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    startTransition(async () => {
      try {
        const url = isEditing
          ? `/api/admin/ingredients/${ingredient.id}`
          : "/api/admin/ingredients";
        const method = isEditing ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.errors?.fieldErrors) {
            const fieldErrors: FormErrors = {};
            for (const [key, msgs] of Object.entries(data.errors.fieldErrors)) {
              const arr = msgs as string[];
              if (arr.length > 0) fieldErrors[key] = arr[0];
            }
            setErrors(fieldErrors);
          } else {
            setServerError(data.message ?? "An error occurred");
          }
          return;
        }

        setSuccess(true);
        router.push("/ingredients");
        router.refresh();
      } catch {
        setServerError("Failed to connect to server");
      }
    });
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50";
  const errorClass = "text-xs text-red-600 mt-1";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          {serverError}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200">
          Saved successfully. Redirecting...
        </div>
      )}

      {/* Name + Category */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Basic Information
        </h2>

        <div>
          <label className={labelClass}>
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            placeholder="e.g. High Gluten Flour"
            className={inputClass}
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isPending}
            className={inputClass}
          >
            <option value="">— No Category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            rows={2}
            placeholder="Optional description..."
            className={inputClass + " resize-none"}
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Purchase Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Purchase Price ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              disabled={isPending}
              step="0.01"
              min="0.01"
              placeholder="0.00"
              className={inputClass}
            />
            {errors.purchasePrice && <p className={errorClass}>{errors.purchasePrice}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Purchase Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={purchaseQuantity}
              onChange={(e) => setPurchaseQuantity(e.target.value)}
              disabled={isPending}
              step="0.001"
              min="0.001"
              placeholder="0.000"
              className={inputClass}
            />
            {errors.purchaseQuantity && (
              <p className={errorClass}>{errors.purchaseQuantity}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Purchase Unit <span className="text-red-500">*</span>
            </label>
            <select
              value={purchaseUnit}
              onChange={(e) => setPurchaseUnit(e.target.value)}
              disabled={isPending}
              className={inputClass}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {errors.purchaseUnit && <p className={errorClass}>{errors.purchaseUnit}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Base Usage Unit <span className="text-red-500">*</span>
            </label>
            <select
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
              disabled={isPending}
              className={inputClass}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {/* Inline unit-pair compatibility hint */}
            {unitConversionHint && !errors.baseUnit && (
              <p className="text-xs text-amber-600 mt-1">{unitConversionHint}</p>
            )}
            {errors.baseUnit && <p className={errorClass}>{errors.baseUnit}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Yield % <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={yieldPercent}
              onChange={(e) => setYieldPercent(e.target.value)}
              disabled={isPending}
              step="0.01"
              min="0.01"
              max="100"
              placeholder="100.00"
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">
              100 means no loss · 85 means only 85% is usable after prep
            </p>
            {errors.yieldPercent && <p className={errorClass}>{errors.yieldPercent}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="taxIncluded"
            type="checkbox"
            checked={taxIncluded}
            onChange={(e) => setTaxIncluded(e.target.checked)}
            disabled={isPending}
            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          <label htmlFor="taxIncluded" className="text-sm text-gray-700">
            Tax Included in purchase price
          </label>
        </div>
      </div>

      {/* Notes + Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Additional
        </h2>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            rows={3}
            placeholder="Internal notes..."
            className={inputClass + " resize-none"}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="isActive"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={isPending}
            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          <label htmlFor="isActive" className="text-sm text-gray-700">
            Active (visible in ingredient lists)
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || success}
          className="px-5 py-2.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Ingredient"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/ingredients")}
          disabled={isPending}
          className="px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
