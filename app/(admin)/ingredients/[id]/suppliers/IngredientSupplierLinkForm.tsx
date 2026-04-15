"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UnitType, SupplierSyncMode } from "@/app/generated/prisma/enums";
import type { IngredientSupplierLinkRow, SupplierRow } from "@/lib/services/supplierService";

interface IngredientSupplierLinkFormProps {
  ingredientId: string;
  suppliers: SupplierRow[];
  link?: IngredientSupplierLinkRow;
}

type FormErrors = Record<string, string | undefined>;

const UNIT_OPTIONS = Object.values(UnitType);
const SYNC_MODE_OPTIONS = Object.values(SupplierSyncMode);

export default function IngredientSupplierLinkForm({
  ingredientId,
  suppliers,
  link,
}: IngredientSupplierLinkFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [supplierId, setSupplierId] = useState(link?.supplierId ?? "");
  const [supplierProductName, setSupplierProductName] = useState(
    link?.supplierProductName ?? ""
  );
  const [supplierProductCode, setSupplierProductCode] = useState(
    link?.supplierProductCode ?? ""
  );
  const [supplierProductUrl, setSupplierProductUrl] = useState(
    link?.supplierProductUrl ?? ""
  );
  const [supplierPackageQuantity, setSupplierPackageQuantity] = useState(
    link?.supplierPackageQuantity ?? ""
  );
  const [supplierPackageUnit, setSupplierPackageUnit] = useState(
    link?.supplierPackageUnit ?? ""
  );
  const [supplierBaseUnit, setSupplierBaseUnit] = useState(
    link?.supplierBaseUnit ?? ""
  );
  const [isPrimary, setIsPrimary] = useState(link?.isPrimary ?? false);
  const [syncMode, setSyncMode] = useState<string>(
    link?.syncMode ?? SupplierSyncMode.MANUAL_ONLY
  );
  const [notes, setNotes] = useState(link?.notes ?? "");
  const [isActive, setIsActive] = useState(link?.isActive ?? true);

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isEditing = !!link;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const newErrors: FormErrors = {};
    if (!supplierId) newErrors.supplierId = "Supplier is required";
    if (!supplierProductName.trim())
      newErrors.supplierProductName = "Supplier product name is required";
    const qty = supplierPackageQuantity ? parseFloat(supplierPackageQuantity as string) : null;
    if (supplierPackageQuantity && (isNaN(qty!) || qty! <= 0)) {
      newErrors.supplierPackageQuantity = "Package quantity must be greater than 0";
    }
    if (supplierProductUrl && !/^https?:\/\/.+/.test(supplierProductUrl)) {
      newErrors.supplierProductUrl = "Must be a valid URL";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: Record<string, unknown> = {
      supplierId,
      supplierProductName,
      supplierProductCode: supplierProductCode || null,
      supplierProductUrl: supplierProductUrl || null,
      supplierPackageQuantity: qty,
      supplierPackageUnit: supplierPackageUnit || null,
      supplierBaseUnit: supplierBaseUnit || null,
      isPrimary,
      syncMode,
      notes: notes || null,
      isActive,
    };

    startTransition(async () => {
      try {
        const url = isEditing
          ? `/api/admin/ingredients/${ingredientId}/supplier-links/${link.id}`
          : `/api/admin/ingredients/${ingredientId}/supplier-links`;
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
        router.push(`/ingredients/${ingredientId}/suppliers`);
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

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Supplier Link Details
        </h2>

        <div>
          <label className={labelClass}>
            Supplier <span className="text-red-500">*</span>
          </label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={isPending || isEditing}
            className={inputClass}
          >
            <option value="">— Select Supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.supplierId && <p className={errorClass}>{errors.supplierId}</p>}
        </div>

        <div>
          <label className={labelClass}>
            Supplier Product Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={supplierProductName}
            onChange={(e) => setSupplierProductName(e.target.value)}
            disabled={isPending}
            placeholder="e.g. High Gluten Bakers Flour 25kg"
            className={inputClass}
          />
          {errors.supplierProductName && (
            <p className={errorClass}>{errors.supplierProductName}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Supplier Product Code</label>
            <input
              type="text"
              value={supplierProductCode}
              onChange={(e) => setSupplierProductCode(e.target.value)}
              disabled={isPending}
              placeholder="e.g. SKU-12345"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Supplier Product URL</label>
            <input
              type="url"
              value={supplierProductUrl}
              onChange={(e) => setSupplierProductUrl(e.target.value)}
              disabled={isPending}
              placeholder="https://..."
              className={inputClass}
            />
            {errors.supplierProductUrl && (
              <p className={errorClass}>{errors.supplierProductUrl}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Package Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Package Quantity</label>
            <input
              type="number"
              value={supplierPackageQuantity}
              onChange={(e) => setSupplierPackageQuantity(e.target.value)}
              disabled={isPending}
              step="0.001"
              min="0.001"
              placeholder="0.000"
              className={inputClass}
            />
            {errors.supplierPackageQuantity && (
              <p className={errorClass}>{errors.supplierPackageQuantity}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Package Unit</label>
            <select
              value={supplierPackageUnit}
              onChange={(e) => setSupplierPackageUnit(e.target.value)}
              disabled={isPending}
              className={inputClass}
            >
              <option value="">— None —</option>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Base Unit</label>
            <select
              value={supplierBaseUnit}
              onChange={(e) => setSupplierBaseUnit(e.target.value)}
              disabled={isPending}
              className={inputClass}
            >
              <option value="">— None —</option>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Settings
        </h2>

        <div>
          <label className={labelClass}>Sync Mode</label>
          <select
            value={syncMode}
            onChange={(e) => setSyncMode(e.target.value)}
            disabled={isPending}
            className={inputClass}
          >
            {SYNC_MODE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
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

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              id="isPrimary"
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              disabled={isPending}
              className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="isPrimary" className="text-sm text-gray-700">
              Primary supplier for this ingredient
            </label>
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
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || success}
          className="px-5 py-2.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Link"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/ingredients/${ingredientId}/suppliers`)}
          disabled={isPending}
          className="px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
