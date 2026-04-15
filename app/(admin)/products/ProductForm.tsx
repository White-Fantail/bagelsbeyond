"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MenuProductRow } from "@/lib/services/menuProductService";
import { PricingTargetType } from "@/app/generated/prisma/enums";

interface ProductFormProps {
  product?: MenuProductRow;
}

type FormErrors = Record<string, string | undefined>;

export default function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [canBeUsedAsRecipeComponent, setCanBeUsedAsRecipeComponent] = useState(
    product?.canBeUsedAsRecipeComponent ?? false
  );
  const [sellingPrice, setSellingPrice] = useState(product?.sellingPrice ?? "");
  const [useOverride, setUseOverride] = useState(
    product?.pricingTargetType != null && product?.pricingTargetPercent != null
  );
  const [pricingTargetType, setPricingTargetType] = useState<PricingTargetType>(
    product?.pricingTargetType ?? PricingTargetType.COST_PERCENT
  );
  const [pricingTargetPercent, setPricingTargetPercent] = useState(
    product?.pricingTargetPercent ?? ""
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isEditing = !!product;

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50";
  const errorClass = "text-xs text-red-600 mt-1";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = "Name is required";
    const sellingPriceNum = sellingPrice !== "" ? parseFloat(String(sellingPrice)) : null;
    if (sellingPriceNum !== null && (isNaN(sellingPriceNum) || sellingPriceNum <= 0)) {
      newErrors.sellingPrice = "Selling price must be greater than 0";
    }
    if (useOverride) {
      const pct = parseFloat(String(pricingTargetPercent));
      if (isNaN(pct) || pct <= 0 || pct >= 100) {
        newErrors.pricingTargetPercent = "Target percent must be between 0 and 100 (exclusive)";
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      name: name.trim(),
      sku: sku.trim() || null,
      notes: notes.trim() || null,
      isActive,
      canBeUsedAsRecipeComponent,
      sellingPrice: sellingPrice !== "" ? parseFloat(String(sellingPrice)) : null,
      pricingTargetType: useOverride ? pricingTargetType : null,
      pricingTargetPercent: useOverride && pricingTargetPercent !== ""
        ? parseFloat(String(pricingTargetPercent))
        : null,
    };

    startTransition(async () => {
      try {
        const url = isEditing
          ? `/api/admin/products/${product.id}`
          : "/api/admin/products";
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
        router.push("/products");
        router.refresh();
      } catch {
        setServerError("Failed to connect to server");
      }
    });
  }

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

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Product Details
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
            placeholder="e.g. Classic Bagel"
            className={inputClass}
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

        <div>
          <label className={labelClass}>SKU</label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            disabled={isPending}
            placeholder="e.g. BGL-001"
            className={inputClass}
          />
          {errors.sku && <p className={errorClass}>{errors.sku}</p>}
        </div>

        <div>
          <label className={labelClass}>Selling Price ($)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            disabled={isPending}
            placeholder="e.g. 5.00"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400">
            Current selling price for this product. Used to calculate cost %, margin %, and price gap.
          </p>
          {errors.sellingPrice && <p className={errorClass}>{errors.sellingPrice}</p>}
        </div>

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
            Active
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="canBeUsedAsRecipeComponent"
            type="checkbox"
            checked={canBeUsedAsRecipeComponent}
            onChange={(e) => setCanBeUsedAsRecipeComponent(e.target.checked)}
            disabled={isPending}
            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          <label htmlFor="canBeUsedAsRecipeComponent" className="text-sm text-gray-700">
            Can be used as recipe component
          </label>
          <span className="text-xs text-gray-400">
            (allows this product to be added as an ingredient in other recipes)
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Pricing Target Override
        </h2>
        <p className="text-xs text-gray-400">
          By default, the global pricing target from Settings is used. Enable the override to set a product-specific target.
        </p>

        <div className="flex items-center gap-3">
          <input
            id="useOverride"
            type="checkbox"
            checked={useOverride}
            onChange={(e) => setUseOverride(e.target.checked)}
            disabled={isPending}
            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          <label htmlFor="useOverride" className="text-sm text-gray-700">
            Use product-specific pricing target
          </label>
        </div>

        {useOverride && (
          <div className="space-y-3 pl-7">
            <div>
              <label className={labelClass}>Target Type</label>
              <select
                value={pricingTargetType}
                onChange={(e) => setPricingTargetType(e.target.value as PricingTargetType)}
                disabled={isPending}
                className={inputClass}
              >
                <option value={PricingTargetType.COST_PERCENT}>Cost % (food cost percentage)</option>
                <option value={PricingTargetType.MARGIN_PERCENT}>Margin % (gross margin)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Target Percent (%)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="99.99"
                value={pricingTargetPercent}
                onChange={(e) => setPricingTargetPercent(e.target.value)}
                disabled={isPending}
                placeholder="e.g. 30"
                className={inputClass}
              />
              {errors.pricingTargetPercent && (
                <p className={errorClass}>{errors.pricingTargetPercent}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || success}
          className="px-5 py-2.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Product"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/products")}
          disabled={isPending}
          className="px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
